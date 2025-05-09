/*
 *			GPAC - Multimedia Framework C SDK
 *
 *			Authors: Jean Le Feuvre
 *			Copyright (c) Telecom ParisTech 2000-2024
 *					All rights reserved
 *
 *  This file is part of GPAC / IETF RTP/RTSP/SDP sub-project
 *
 *  GPAC is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU Lesser General Public License as published by
 *  the Free Software Foundation; either version 2, or (at your option)
 *  any later version.
 *
 *  GPAC is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Lesser General Public License for more details.
 *
 *  You should have received a copy of the GNU Lesser General Public
 *  License along with this library; see the file COPYING.  If not, write to
 *  the Free Software Foundation, 675 Mass Ave, Cambridge, MA 02139, USA.
 *
 */


#include <gpac/rtp_streamer.h>
#include <gpac/constants.h>
#include <gpac/base_coding.h>
#ifndef GPAC_DISABLE_AV_PARSERS
#include <gpac/avparse.h>
#endif
#include <gpac/internal/ietf_dev.h>

#if !defined(GPAC_DISABLE_STREAMING)

/*for ISOBMFF subtypes*/
#include <gpac/isomedia.h>

#define RTCP_BUF_SIZE	10000
struct __rtp_streamer
{
	GP_RTPPacketizer *packetizer;
	GF_RTPChannel *channel;

	/* The current packet being formed */
	char *buffer;
	u32 payload_len, buffer_alloc;

	u32 in_timescale;
	char rtcp_buf[RTCP_BUF_SIZE];

	const char *netcap_id;
	GF_Err last_err;
};


/*callbacks from packetizer to channel*/

static void rtp_stream_on_new_packet(void *cbk, GF_RTPHeader *header)
{
}

static void rtp_stream_on_packet_done(void *cbk, GF_RTPHeader *header)
{
	GF_RTPStreamer *rtp = (GF_RTPStreamer*)cbk;
	GF_Err e = gf_rtp_send_packet(rtp->channel, header, rtp->buffer+12, rtp->payload_len, GF_TRUE);

#ifndef GPAC_DISABLE_LOG
	if (e) {
		rtp->last_err = e;
		GF_LOG(GF_LOG_ERROR, GF_LOG_RTP, ("[RTP] Error %s sending RTP packet SN %u - TS %u\n", gf_error_to_string(e), header->SequenceNumber, header->TimeStamp));
	} else {
		GF_LOG(GF_LOG_DEBUG, GF_LOG_RTP, ("RTP SN %u - TS %u - M %u - Size %u\n", header->SequenceNumber, header->TimeStamp, header->Marker, rtp->payload_len + 12));
	}
#else
	if (e) {
		fprintf(stderr, "Error %s sending RTP packet SN %u - TS %u\n", gf_error_to_string(e), header->SequenceNumber, header->TimeStamp);
	}
#endif
	rtp->payload_len = 0;
}

static void rtp_stream_on_data(void *cbk, u8 *data, u32 data_size, Bool is_head)
{
	GF_RTPStreamer *rtp = (GF_RTPStreamer*)cbk;
	if (!data ||!data_size) return;

	if (rtp->payload_len+data_size+12 > rtp->buffer_alloc) {
		GF_LOG(GF_LOG_ERROR, GF_LOG_RTP, ("[RTP] Packet size %d bigger than MTU size %d - discarding\n", rtp->payload_len+data_size+12, rtp->buffer_alloc));
		rtp->payload_len += data_size;
		return;
	}
	if (!is_head) {
		memcpy(rtp->buffer + rtp->payload_len + 12, data, data_size);
	} else {
		memmove(rtp->buffer + data_size + 12, rtp->buffer + 12, rtp->payload_len);
		memcpy(rtp->buffer + 12, data, data_size);
	}
	rtp->payload_len += data_size;
}


GF_Err gf_rtp_streamer_init_rtsp(GF_RTPStreamer *rtp, u32 path_mtu, GF_RTSPTransport *tr, const char *ifce_addr)
{
	GF_Err res;

	if (!rtp->channel) {
		rtp->channel = gf_rtp_new_ex(rtp->netcap_id);
		if (!rtp->channel) return GF_OUT_OF_MEM;
		rtp->channel->TimeScale = rtp->packetizer->sl_config.timestampResolution;
	}
	res = gf_rtp_setup_transport(rtp->channel, tr, tr->destination);
	if (res !=0) {
		GF_LOG(GF_LOG_ERROR, GF_LOG_RTP, ("Cannot setup RTP transport info: %s\n", gf_error_to_string(res) ));
		return res;
	}

	res = gf_rtp_initialize(rtp->channel, 0, GF_TRUE, path_mtu, 0, 0, (char *)ifce_addr);
	if (res !=0) {
		GF_LOG(GF_LOG_ERROR, GF_LOG_RTP, ("Cannot initialize RTP sockets: %s\n", gf_error_to_string(res) ));
		return res;
	}
	return GF_OK;
}
static GF_Err rtp_stream_init_channel(GF_RTPStreamer *rtp, u32 path_mtu, const char * dest, int port, int ttl, const char *ifce_addr, const char *netcap_id)
{
	GF_RTSPTransport tr;
	GF_Err res;

	rtp->channel = gf_rtp_new_ex(netcap_id);
	if (!rtp->channel) return GF_OUT_OF_MEM;
	rtp->channel->TimeScale = rtp->packetizer->sl_config.timestampResolution;

	//gf_rtp_set_ports(rtp->channel, 0);
	memset(&tr, 0, sizeof(GF_RTSPTransport));

	tr.IsUnicast = gf_sk_is_multicast_address(dest) ? GF_FALSE : GF_TRUE;
	tr.Profile="RTP/AVP";
	tr.destination = (char *)dest;
	tr.source = "0.0.0.0";
	tr.IsRecord = GF_FALSE;
	tr.Append = GF_FALSE;
	tr.SSRC = rand();
	tr.TTL = ttl;

	tr.port_first = port;
	tr.port_last = port+1;
	if (tr.IsUnicast) {
		tr.client_port_first = port;
		tr.client_port_last  = port+1;
	} else {
		tr.source = (char *)dest;
	}

	res = gf_rtp_setup_transport(rtp->channel, &tr, dest);
	if (res !=0) {
		GF_LOG(GF_LOG_ERROR, GF_LOG_RTP, ("Cannot setup RTP transport info: %s\n", gf_error_to_string(res) ));
		return res;
	}

	res = gf_rtp_initialize(rtp->channel, 0, GF_TRUE, path_mtu, 0, 0, (char *)ifce_addr);
	if (res !=0) {
		GF_LOG(GF_LOG_ERROR, GF_LOG_RTP, ("Cannot initialize RTP sockets: %s\n", gf_error_to_string(res) ));
		return res;
	}
	return GF_OK;
}

GF_EXPORT
GF_RTPStreamer *gf_rtp_streamer_new_ex(const GF_RTPStreamerConfig *cfg, Bool for_rtsp)
{
	GF_SLConfig slc;
	GF_RTPStreamer *stream;
	u32 rtp_type, default_rtp_rate;
	u8 OfficialPayloadType;
	u32 required_rate, force_dts_delta, PL_ID;
	char *mpeg4mode;
	Bool has_mpeg4_mapping;
	GF_Err e;

	u32 timeScale = cfg->timeScale ? cfg->timeScale : 1000;
	u32 flags = cfg->flags;
	u32 streamType = cfg->streamType;
	u32 codecid = cfg->codecid;
	u32 PayloadType = cfg->PayloadType;
	u32 maxDTSDelta = cfg->maxDTSDelta;
	u32 max_ptime = cfg->max_ptime;

	GF_SAFEALLOC(stream, GF_RTPStreamer);
	if (!stream) return NULL;


	/*by default NO PL signaled*/
	PL_ID = 0;
	OfficialPayloadType = 0;
	force_dts_delta = 0;
	mpeg4mode = NULL;
	required_rate = 0;
	has_mpeg4_mapping = GF_TRUE;
	rtp_type = 0;

	/*for max compatibility with QT*/
	default_rtp_rate = 90000;

	/*timed-text is a bit special, we support multiple stream descriptions & co*/
	switch (cfg->streamType) {
	case GF_STREAM_AUDIO:
		required_rate = cfg->sample_rate;
		break;
	case GF_STREAM_VISUAL:
		rtp_type = GF_RTP_PAYT_MPEG4;
		required_rate = default_rtp_rate;
		if (cfg->is_crypted) {
			/*that's another pain with ISMACryp, even if no B-frames the DTS is signaled...*/
			if (cfg->codecid==GF_CODECID_MPEG4_PART2) force_dts_delta = 22;
			flags |= GP_RTP_PCK_SIGNAL_RAP | GP_RTP_PCK_SIGNAL_TS;
		}
		break;
	case GF_STREAM_SCENE:
	case GF_STREAM_OD:
		if (cfg->codecid == GF_CODECID_DIMS) {
#if GPAC_ENABLE_3GPP_DIMS_RTP
			rtp_type = GF_RTP_PAYT_3GPP_DIMS;
			has_mpeg4_mapping = GF_FALSE;
#else
			gf_rtp_streamer_del(stream);
			GF_LOG(GF_LOG_ERROR, GF_LOG_RTP, ("[RTP Packetizer] 3GPP DIMS over RTP disabled in build\n", cfg->streamType));
			return NULL;
#endif
		} else {
			rtp_type = GF_RTP_PAYT_MPEG4;
		}
		break;
	}

	switch (cfg->codecid) {
	/*AAC*/
	case GF_CODECID_AAC_MPEG4:
	case GF_CODECID_AAC_MPEG2_MP:
	case GF_CODECID_AAC_MPEG2_LCP:
	case GF_CODECID_AAC_MPEG2_SSRP:
		PL_ID = 0x01;
		mpeg4mode = "AAC";
		rtp_type = GF_RTP_PAYT_MPEG4;
		required_rate = cfg->sample_rate;

#ifndef GPAC_DISABLE_AV_PARSERS
		if (cfg->dsi) {
			GF_M4ADecSpecInfo a_cfg;
			gf_m4a_get_config((u8 *)cfg->dsi, cfg->dsi_len, &a_cfg);
			//nb_ch = a_cfg.nb_chan;
			//sample_rate = a_cfg.base_sr;
			PL_ID = a_cfg.audioPL;
			switch (a_cfg.base_object_type) {
			case GF_M4A_AAC_MAIN:
			case GF_M4A_AAC_LC:
				if (flags & GP_RTP_PCK_USE_LATM_AAC) {
					rtp_type = GF_RTP_PAYT_LATM;
					break;
				}
			case GF_M4A_AAC_SBR:
			case GF_M4A_AAC_PS:
			case GF_M4A_AAC_LTP:
			case GF_M4A_AAC_SCALABLE:
			case GF_M4A_ER_AAC_LC:
			case GF_M4A_ER_AAC_LTP:
			case GF_M4A_ER_AAC_SCALABLE:
				mpeg4mode = "AAC";
				break;
			case GF_M4A_CELP:
			case GF_M4A_ER_CELP:
				mpeg4mode = "CELP";
				break;
			}
		}
#endif
		break;

	/*MPEG1/2 audio*/
	case GF_CODECID_MPEG2_PART3:
	case GF_CODECID_MPEG_AUDIO:
	case GF_CODECID_MPEG_AUDIO_L1:
		if (!cfg->is_crypted) {
			rtp_type = GF_RTP_PAYT_MPEG12_AUDIO;
			/*use official RTP/AVP payload type*/
			OfficialPayloadType = 14;
			required_rate = 90000;
		}
		/*encrypted MP3 must be sent through MPEG-4 generic to signal all ISMACryp stuff*/
		else {
			rtp_type = GF_RTP_PAYT_MPEG4;
		}
		break;

	/*ISO/IEC 14496-2*/
	case GF_CODECID_MPEG4_PART2:
		PL_ID = 1;
#ifndef GPAC_DISABLE_AV_PARSERS
		if (cfg->dsi) {
			GF_M4VDecSpecInfo vhdr;
			gf_m4v_get_config((u8 *)cfg->dsi, cfg->dsi_len, &vhdr);
			PL_ID = vhdr.VideoPL;
		}
#endif
		break;

	/*MPEG1/2 video*/
	case GF_CODECID_MPEG1:
	case GF_CODECID_MPEG2_SIMPLE:
	case GF_CODECID_MPEG2_MAIN:
	case GF_CODECID_MPEG2_SNR:
	case GF_CODECID_MPEG2_SPATIAL:
	case GF_CODECID_MPEG2_HIGH:
	case GF_CODECID_MPEG2_422:
		if (!cfg->is_crypted) {
			rtp_type = GF_RTP_PAYT_MPEG12_VIDEO;
			OfficialPayloadType = 32;
		}
		break;
	/*AVC/H.264*/
	case GF_CODECID_AVC:
		required_rate = 90000;	/* "90 kHz clock rate MUST be used"*/
		rtp_type = GF_RTP_PAYT_H264_AVC;
		PL_ID = 0x0F;
		break;
	/*H264-SVC*/
	case GF_CODECID_SVC:
	case GF_CODECID_MVC:
		required_rate = 90000;	/* "90 kHz clock rate MUST be used"*/
		rtp_type = GF_RTP_PAYT_H264_SVC;
		PL_ID = 0x0F;
		break;

	/*HEVC*/
	case GF_CODECID_HEVC:
		required_rate = 90000;	/* "90 kHz clock rate MUST be used"*/
		rtp_type = GF_RTP_PAYT_HEVC;
		PL_ID = 0x0F;
		break;
	/*LHVC*/
	case GF_CODECID_LHVC:
		required_rate = 90000;	/* "90 kHz clock rate MUST be used"*/
		rtp_type = GF_RTP_PAYT_LHVC;
		PL_ID = 0x0F;
		break;
	/*VVC*/
	case GF_CODECID_VVC:
		required_rate = 90000;	/* "90 kHz clock rate MUST be used"*/
		rtp_type = GF_RTP_PAYT_VVC;
		PL_ID = 0x0F;
		break;
	case GF_CODECID_H263:
		rtp_type = GF_RTP_PAYT_H263;
		required_rate = 90000;
		streamType = GF_STREAM_VISUAL;
		OfficialPayloadType = 34;
		/*not 100% compliant (short header is missing) but should still work*/
		codecid = GF_CODECID_MPEG4_PART2;
		PL_ID = 0x01;
		break;
	case GF_CODECID_AMR:
		required_rate = 8000;
		rtp_type = GF_RTP_PAYT_AMR;
		streamType = GF_STREAM_AUDIO;
		has_mpeg4_mapping = GF_FALSE;
		break;
	case GF_CODECID_AMR_WB:
		required_rate = 16000;
		rtp_type = GF_RTP_PAYT_AMR_WB;
		streamType = GF_STREAM_AUDIO;
		has_mpeg4_mapping = GF_FALSE;
		break;
	case GF_CODECID_AC3:
		rtp_type = GF_RTP_PAYT_AC3;
		streamType = GF_STREAM_AUDIO;
		has_mpeg4_mapping = GF_TRUE;
		break;
	case GF_CODECID_EAC3:
		rtp_type = GF_RTP_PAYT_EAC3;
		streamType = GF_STREAM_AUDIO;
		has_mpeg4_mapping = GF_FALSE;
		break;

	case GF_CODECID_QCELP:
		required_rate = 8000;
		rtp_type = GF_RTP_PAYT_QCELP;
		streamType = GF_STREAM_AUDIO;
		codecid = GF_CODECID_QCELP;
		OfficialPayloadType = 12;
//			nb_ch = 1;
		break;
	case GF_CODECID_EVRC:
	case GF_CODECID_SMV:
		required_rate = 8000;
		rtp_type = GF_RTP_PAYT_EVRC_SMV;
		streamType = GF_STREAM_AUDIO;
		codecid = (codecid==GF_ISOM_SUBTYPE_3GP_EVRC) ? GF_CODECID_EVRC : GF_CODECID_SMV;
//			nb_ch = 1;
		break;
	case GF_CODECID_TX3G:
		rtp_type = GF_RTP_PAYT_3GPP_TEXT;
		/*fixme - this works cos there's only one PL for text in mpeg4 at the current time*/
		PL_ID = 0x10;
		break;
	case GF_CODECID_TEXT_MPEG4:
		rtp_type = GF_RTP_PAYT_3GPP_TEXT;
		/*fixme - this works cos there's only one PL for text in mpeg4 at the current time*/
		PL_ID = 0x10;
		break;
	case GF_CODECID_FAKE_MP2T:
		rtp_type = GF_RTP_PAYT_MP2T;
		PayloadType = OfficialPayloadType = GF_RTP_PAYT_MP2T;
		required_rate = 90000;
		break;
	case GF_CODECID_OPUS:
		rtp_type = GF_RTP_PAYT_OPUS;
		streamType = GF_STREAM_AUDIO;
		has_mpeg4_mapping = GF_FALSE;
		break;

	default:
		if (!rtp_type) {
			GF_LOG(GF_LOG_ERROR, GF_LOG_RTP, ("[RTP Packetizer] Unsupported stream type %x\n", streamType));
			gf_rtp_streamer_del(stream);
			return NULL;
		}
		break;
	}

	if (flags & GP_RTP_PCK_FORCE_STATIC_ID) {
		if (!OfficialPayloadType) {
			GF_LOG(GF_LOG_ERROR, GF_LOG_RTP, ("[RTP Packetizer] Codec type %s requires SDP output\n",  gf_codecid_name(codecid) ));
			gf_rtp_streamer_del(stream);
			return NULL;
		}
		PayloadType = OfficialPayloadType;
	}
	/*override hinter type if requested and possible*/
	else if (has_mpeg4_mapping && (flags & GP_RTP_PCK_FORCE_MPEG4)) {
		rtp_type = GF_RTP_PAYT_MPEG4;
	}
	/*use static payload ID if enabled*/
	else if (OfficialPayloadType && (flags & GP_RTP_PCK_USE_STATIC_ID) ) {
		PayloadType = OfficialPayloadType;
	}

	/*systems carousel: we need at least IDX and RAP signaling*/
	if (flags & GP_RTP_PCK_SYSTEMS_CAROUSEL) {
		flags |= GP_RTP_PCK_SIGNAL_RAP;
	}

	/*update flags in MultiSL*/
	if (flags & GP_RTP_PCK_USE_MULTI) {
		if (cfg->MinSize != cfg->MaxSize) flags |= GP_RTP_PCK_SIGNAL_SIZE;
		if (!cfg->const_dur) flags |= GP_RTP_PCK_SIGNAL_TS;
	}

	/*default SL for RTP */
	memset(&slc, 0, sizeof(GF_SLConfig));
	slc.tag = GF_ODF_SLC_TAG;
	slc.useTimestampsFlag = 1;
	slc.timestampLength = 32;
	slc.timestampResolution = timeScale;

	/*override clockrate if set*/
	if (required_rate) {
		Double sc = required_rate;
		sc /= slc.timestampResolution;
		maxDTSDelta = (u32) (maxDTSDelta*sc);
		slc.timestampResolution = required_rate;
	}
	/*switch to RTP TS*/
	max_ptime = (u32) (max_ptime * slc.timestampResolution / 1000);

	slc.AUSeqNumLength = cfg->au_sn_len;
	slc.CUDuration = cfg->const_dur;

	if (flags & GP_RTP_PCK_SIGNAL_RAP) {
		slc.useRandomAccessPointFlag = 1;
	} else {
		slc.useRandomAccessPointFlag = 0;
		slc.hasRandomAccessUnitsOnlyFlag = 1;
	}

	stream->packetizer = gf_rtp_builder_new(rtp_type, &slc, flags,
	                                        stream,
	                                        rtp_stream_on_new_packet, rtp_stream_on_packet_done,
	                                        NULL, rtp_stream_on_data);

	if (!stream->packetizer) {
		GF_LOG(GF_LOG_ERROR, GF_LOG_RTP, ("[RTP Packetizer] Failed to create packetizer\n"));
		gf_rtp_streamer_del(stream);
		return NULL;
	}

	gf_rtp_builder_init(stream->packetizer, (u8) PayloadType, cfg->MTU, max_ptime,
	                    streamType, codecid, PL_ID, cfg->MinSize, cfg->MaxSize, cfg->avgTS, maxDTSDelta, cfg->IV_length, cfg->KI_length, mpeg4mode);


	if (force_dts_delta) stream->packetizer->slMap.DTSDeltaLength = force_dts_delta;

	if (!for_rtsp) {
		e = rtp_stream_init_channel(stream, cfg->MTU + 12, cfg->ip_dest, cfg->port, cfg->TTL, cfg->ifce_addr, cfg->netcap_id);
		if (e) {
			GF_LOG(GF_LOG_ERROR, GF_LOG_RTP, ("[RTP Packetizer] Failed to create RTP channel - error %s\n", gf_error_to_string(e) ));
			gf_rtp_streamer_del(stream);
			return NULL;
		}
	}

	stream->in_timescale = timeScale;
	stream->netcap_id = cfg->netcap_id;

	stream->buffer_alloc = cfg->MTU+12;
	stream->buffer = (char*)gf_malloc(sizeof(char) * stream->buffer_alloc);

	return stream;
}

GF_EXPORT
GF_RTPStreamer *gf_rtp_streamer_new(u32 streamType, u32 codecid, u32 timeScale,
        const char *ip_dest, u16 port, u32 MTU, u8 TTL, const char *ifce_addr,
        u32 flags, const u8 *dsi, u32 dsi_len,
        u32 PayloadType, u32 sample_rate, u32 nb_ch,
        Bool is_crypted, u32 IV_length, u32 KI_length,
        u32 MinSize, u32 MaxSize, u32 avgTS, u32 maxDTSDelta, u32 const_dur, u32 bandwidth, u32 max_ptime,
        u32 au_sn_len, Bool for_rtsp)
{
	GF_RTPStreamerConfig cfg;
	memset(&cfg, 0, sizeof(GF_RTPStreamerConfig));
#define RTCFG_SET(_t) cfg._t = _t

	RTCFG_SET(streamType);
	RTCFG_SET(codecid);
	RTCFG_SET(timeScale);
	RTCFG_SET(ip_dest);
	RTCFG_SET(port);
	RTCFG_SET(MTU);
	RTCFG_SET(TTL);
	RTCFG_SET(ifce_addr);
	RTCFG_SET(flags);
	RTCFG_SET(dsi);
	RTCFG_SET(dsi_len);
	RTCFG_SET(PayloadType);
	RTCFG_SET(sample_rate);
	RTCFG_SET(nb_ch);
	RTCFG_SET(is_crypted);
	RTCFG_SET(IV_length);
	RTCFG_SET(KI_length);
	RTCFG_SET(MinSize);
	RTCFG_SET(MaxSize);
	RTCFG_SET(avgTS);
	RTCFG_SET(maxDTSDelta);
	RTCFG_SET(const_dur);
	RTCFG_SET(bandwidth);
	RTCFG_SET(max_ptime);
	RTCFG_SET(au_sn_len);
#undef RTCFG_SET

	return gf_rtp_streamer_new_ex(&cfg, for_rtsp);
}


GF_EXPORT
void gf_rtp_streamer_del(GF_RTPStreamer *streamer)
{
	if (streamer) {
		if (streamer->channel) gf_rtp_del(streamer->channel);
		if (streamer->packetizer) gf_rtp_builder_del(streamer->packetizer);
		if (streamer->buffer) gf_free(streamer->buffer);
		gf_free(streamer);
	}
}

#if !defined(GPAC_DISABLE_ISOM) && !defined(GPAC_DISABLE_STREAMING)

void gf_media_format_ttxt_sdp(GP_RTPPacketizer *builder, char *payload_name, char **out_sdp_line, u32 w, u32 h, s32 tx, s32 ty, s16 l, u32 max_w, u32 max_h, char *tx3g_base64)
{
	char tmp_buf[101];
	if (!out_sdp_line) return;
	if (*out_sdp_line)
		(*out_sdp_line)[0] = 0;

	tmp_buf[100] = 0;
	snprintf(tmp_buf, 100, "a=fmtp:%d sver=60; ", builder->PayloadType);
	gf_dynstrcat(out_sdp_line, tmp_buf, NULL);

	snprintf(tmp_buf, 100, "width=%d; height=%d; tx=%d; ty=%d; layer=%d; ", w, h, tx, ty, l);
	gf_dynstrcat(out_sdp_line, tmp_buf, NULL);

	snprintf(tmp_buf, 100, "max-w=%d; max-h=%d", max_w, max_h);
	gf_dynstrcat(out_sdp_line, tmp_buf, NULL);

	if (tx3g_base64) {
		gf_dynstrcat(out_sdp_line, "; tx3g=", NULL);
		gf_dynstrcat(out_sdp_line, tx3g_base64, NULL);
	}
}

#endif /*!defined(GPAC_DISABLE_ISOM) && !defined(GPAC_DISABLE_STREAMING)*/


GF_EXPORT
GF_Err gf_rtp_streamer_append_sdp_extended(GF_RTPStreamer *rtp, u16 ESID, const u8 *dsi, u32 dsi_len, const u8 *dsi_enh, u32 dsi_enh_len, char *KMS_URI, u32 width, u32 height, u32 tw, u32 th, s32 tx, s32 ty, s16 tl, u32 nb_channels, Bool for_rtsp, char **out_sdp_buffer)
{
	u16 port=0;
	char mediaName[30], payloadName[30];
	char tmp_buf[101];

	tmp_buf[100]=0;
	if (!out_sdp_buffer) return GF_BAD_PARAM;

	gf_rtp_builder_get_payload_name(rtp->packetizer, payloadName, mediaName);
	if (!for_rtsp) {
		//this can happen when forwarding a multicast SDP from RTSP, where only a subset of streams have been setup
		if (!rtp->channel) return GF_OK;
		gf_rtp_get_ports(rtp->channel, &port, NULL);
	}

	snprintf(tmp_buf, 100, "m=%s %d RTP/%s %u\n", mediaName, for_rtsp ? 0 : port, rtp->packetizer->slMap.IV_length ? "SAVP" : "AVP", rtp->packetizer->PayloadType);
	gf_dynstrcat(out_sdp_buffer, tmp_buf, NULL);
	if (nb_channels > 1)
		snprintf(tmp_buf, 100, "a=rtpmap:%u %s/%u/%u\n", rtp->packetizer->PayloadType, payloadName, rtp->packetizer->sl_config.timestampResolution, nb_channels);
	else
		snprintf(tmp_buf, 100, "a=rtpmap:%u %s/%u\n", rtp->packetizer->PayloadType, payloadName, rtp->packetizer->sl_config.timestampResolution);
	gf_dynstrcat(out_sdp_buffer, tmp_buf, NULL);

	if (ESID
#if GPAC_ENABLE_3GPP_DIMS_RTP
		&& (rtp->packetizer->rtp_payt != GF_RTP_PAYT_3GPP_DIMS)
#endif
		&& (rtp->packetizer->rtp_payt != GF_RTP_PAYT_OPUS)
	 ) {
		snprintf(tmp_buf, 100, "a=mpeg4-esid:%d\n", ESID);
		gf_dynstrcat(out_sdp_buffer, tmp_buf, NULL);
	}

	if (width && height) {
		if (rtp->packetizer->rtp_payt == GF_RTP_PAYT_H263) {
			snprintf(tmp_buf, 100, "a=cliprect:0,0,%d,%d\n", height, width);
			gf_dynstrcat(out_sdp_buffer, tmp_buf, NULL);
		}
		/*extensions for some mobile phones*/
		snprintf(tmp_buf, 100, "a=framesize:%d %d-%d\n", rtp->packetizer->PayloadType, width, height);
		gf_dynstrcat(out_sdp_buffer, tmp_buf, NULL);
	}

	/*AMR*/
	if ((rtp->packetizer->rtp_payt == GF_RTP_PAYT_AMR) || (rtp->packetizer->rtp_payt == GF_RTP_PAYT_AMR_WB)) {
		snprintf(tmp_buf, 100, "a=fmtp:%d octet-align=1\n", rtp->packetizer->PayloadType);
		gf_dynstrcat(out_sdp_buffer, tmp_buf, NULL);
	}
#if !defined(GPAC_DISABLE_ISOM) && !defined(GPAC_DISABLE_STREAMING)
	/*Text*/
	else if (rtp->packetizer->rtp_payt == GF_RTP_PAYT_3GPP_TEXT) {
		char *sdp = NULL;
		gf_media_format_ttxt_sdp(rtp->packetizer, payloadName, &sdp, tw, th, tx, ty, tl, width, height, (u8 *)dsi_enh);
		gf_dynstrcat(out_sdp_buffer, sdp, NULL);
		gf_dynstrcat(out_sdp_buffer, "\n", NULL);
		if (sdp) gf_free(sdp);
	}
#endif
	/*EVRC/SMV in non header-free mode*/
	else if ((rtp->packetizer->rtp_payt == GF_RTP_PAYT_EVRC_SMV) && (rtp->packetizer->auh_size>1)) {
		snprintf(tmp_buf, 100, "a=fmtp:%d maxptime=%d\n", rtp->packetizer->PayloadType, rtp->packetizer->auh_size*20);
		gf_dynstrcat(out_sdp_buffer, tmp_buf, NULL);
	}
	/*H264/AVC*/
	else if ((rtp->packetizer->rtp_payt == GF_RTP_PAYT_H264_AVC) || (rtp->packetizer->rtp_payt == GF_RTP_PAYT_H264_SVC)) {
		GF_AVCConfig *avcc = dsi ? gf_odf_avc_cfg_read((u8*)dsi, dsi_len) : NULL;

		if (avcc) {
			snprintf(tmp_buf, 100, "a=fmtp:%d profile-level-id=%02X%02X%02X; packetization-mode=1", rtp->packetizer->PayloadType, avcc->AVCProfileIndication, avcc->profile_compatibility, avcc->AVCLevelIndication);
			gf_dynstrcat(out_sdp_buffer, tmp_buf, NULL);

			if (gf_list_count(avcc->pictureParameterSets) || gf_list_count(avcc->sequenceParameterSets)) {
				u32 i, count, b64s;
				char b64[200];
				gf_dynstrcat(out_sdp_buffer, "; sprop-parameter-sets=", NULL);

				count = gf_list_count(avcc->sequenceParameterSets);
				for (i=0; i<count; i++) {
					GF_NALUFFParam *sl = (GF_NALUFFParam *)gf_list_get(avcc->sequenceParameterSets, i);
					b64s = gf_base64_encode(sl->data, sl->size, b64, 200);
					b64[b64s]=0;
					gf_dynstrcat(out_sdp_buffer, b64, NULL);
					if (i+1<count) gf_dynstrcat(out_sdp_buffer, ",", NULL);
				}
				if (i) gf_dynstrcat(out_sdp_buffer, ",", NULL);
				count = gf_list_count(avcc->pictureParameterSets);
				for (i=0; i<count; i++) {
					GF_NALUFFParam *sl = (GF_NALUFFParam *)gf_list_get(avcc->pictureParameterSets, i);
					b64s = gf_base64_encode(sl->data, sl->size, b64, 200);
					b64[b64s]=0;
					gf_dynstrcat(out_sdp_buffer, b64, NULL);
					if (i+1<count) gf_dynstrcat(out_sdp_buffer, ",", NULL);
				}
			}
			gf_odf_avc_cfg_del(avcc);
			gf_dynstrcat(out_sdp_buffer, "\n", NULL);
		}
	}
	else if ((rtp->packetizer->rtp_payt == GF_RTP_PAYT_HEVC)
		|| (rtp->packetizer->rtp_payt == GF_RTP_PAYT_LHVC)
		|| (rtp->packetizer->rtp_payt == GF_RTP_PAYT_VVC)
	) {
		GF_VVCConfig *vvcc = NULL;
		GF_HEVCConfig *hvcc = NULL;
		GF_List *param_array = NULL;
		u8 sps_nut=0, pps_nut=0, vps_nut=0;
		if (rtp->packetizer->rtp_payt == GF_RTP_PAYT_VVC) {
			vvcc = dsi ? gf_odf_vvc_cfg_read((u8*)dsi, dsi_len) : NULL;
			param_array = vvcc ? vvcc->param_array : NULL;
			sps_nut = GF_VVC_NALU_SEQ_PARAM;
			pps_nut = GF_VVC_NALU_PIC_PARAM;
			vps_nut = GF_VVC_NALU_VID_PARAM;
		} else {
			if (dsi) {
				hvcc = gf_odf_hevc_cfg_read((u8*)dsi, dsi_len, GF_FALSE);
			} else if (dsi_enh) {
				hvcc = gf_odf_hevc_cfg_read((u8*)dsi_enh, dsi_enh_len, GF_TRUE);
			}
			param_array = hvcc ? hvcc->param_array : NULL;
			sps_nut = GF_HEVC_NALU_SEQ_PARAM;
			pps_nut = GF_HEVC_NALU_PIC_PARAM;
			vps_nut = GF_HEVC_NALU_VID_PARAM;
		}

		if (param_array) {
			u32 count, i, j, b64s;
			char b64[200];
			snprintf(tmp_buf, 100, "a=fmtp:%d", rtp->packetizer->PayloadType);
			gf_dynstrcat(out_sdp_buffer, tmp_buf, NULL);

			count = gf_list_count(param_array);
			for (i = 0; i < count; i++) {
				GF_NALUFFParamArray *ar = (GF_NALUFFParamArray *)gf_list_get(param_array, i);
				if (ar->type==sps_nut) {
					gf_dynstrcat(out_sdp_buffer, "; sprop-sps=", NULL);
				} else if (ar->type==pps_nut) {
					gf_dynstrcat(out_sdp_buffer, "; sprop-pps=", NULL);
				} else if (ar->type==vps_nut) {
					gf_dynstrcat(out_sdp_buffer, "; sprop-vps=", NULL);
				}
				for (j = 0; j < gf_list_count(ar->nalus); j++) {
					GF_NALUFFParam *sl = (GF_NALUFFParam *)gf_list_get(ar->nalus, j);
					b64s = gf_base64_encode(sl->data, sl->size, b64, 200);
					b64[b64s]=0;
					if (j) gf_dynstrcat(out_sdp_buffer, ", ", NULL);
					gf_dynstrcat(out_sdp_buffer, b64, NULL);
				}
			}
			if (vvcc) gf_odf_vvc_cfg_del(vvcc);
			if (hvcc) gf_odf_hevc_cfg_del(hvcc);
			gf_dynstrcat(out_sdp_buffer, "\n", NULL);
		}
	}
	/*MPEG-4 decoder config*/
	else if (rtp->packetizer->rtp_payt==GF_RTP_PAYT_MPEG4) {
		char *sdp = NULL;
		gf_rtp_builder_format_sdp(rtp->packetizer, payloadName, &sdp, (u8*)dsi, dsi_len);
		gf_dynstrcat(out_sdp_buffer, sdp, NULL);
		gf_dynstrcat(out_sdp_buffer, "\n", NULL);
		if (sdp) gf_free(sdp);

		if (rtp->packetizer->slMap.IV_length && KMS_URI) {
			if (!strnicmp(KMS_URI, "(key)", 5) || !strnicmp(KMS_URI, "(ipmp)", 6) || !strnicmp(KMS_URI, "(uri)", 5)) {
				gf_dynstrcat(out_sdp_buffer, "; ISMACrypKey=", NULL);
			} else {
				gf_dynstrcat(out_sdp_buffer, "; ISMACrypKey=(uri)", NULL);
			}
			gf_dynstrcat(out_sdp_buffer, KMS_URI, NULL);
			gf_dynstrcat(out_sdp_buffer, "\n", NULL);
		}
	}
#if GPAC_ENABLE_3GPP_DIMS_RTP
	/*DIMS decoder config*/
	else if (rtp->packetizer->rtp_payt==GF_RTP_PAYT_3GPP_DIMS) {
		snprintf(tmp_buf, 100, "a=fmtp:%d Version-profile=%d", rtp->packetizer->PayloadType, 10);
		gf_dynstrcat(out_sdp_buffer, tmp_buf, NULL);
		if (rtp->packetizer->flags & GP_RTP_DIMS_COMPRESSED) {
			gf_dynstrcat(out_sdp_buffer, ";content-coding=deflate", NULL);
		}
		gf_dynstrcat(out_sdp_buffer, "\n", NULL);
	}
#endif
	/*MPEG-4 Audio LATM*/
	else if (rtp->packetizer->rtp_payt==GF_RTP_PAYT_LATM) {
		GF_BitStream *bs;
		u8 *config_bytes;
		u32 config_size;

		/* form config string */
		bs = gf_bs_new(NULL, 32, GF_BITSTREAM_WRITE);
		gf_bs_write_int(bs, 0, 1); /* AudioMuxVersion */
		gf_bs_write_int(bs, 1, 1); /* all streams same time */
		gf_bs_write_int(bs, 0, 6); /* numSubFrames */
		gf_bs_write_int(bs, 0, 4); /* numPrograms */
		gf_bs_write_int(bs, 0, 3); /* numLayer */

		/* audio-specific config  - PacketVideo patch: don't signal SBR and PS stuff, not allowed in LATM with audioMuxVersion=0*/
		if (dsi) gf_bs_write_data(bs, dsi, MIN(dsi_len, 2) );

		/* other data */
		gf_bs_write_int(bs, 0, 3); /* frameLengthType */
		gf_bs_write_int(bs, 0xff, 8); /* latmBufferFullness */
		gf_bs_write_int(bs, 0, 1); /* otherDataPresent */
		gf_bs_write_int(bs, 0, 1); /* crcCheckPresent */
		gf_bs_get_content(bs, &config_bytes, &config_size);
		gf_bs_del(bs);

		char *sdp = NULL;
		gf_rtp_builder_format_sdp(rtp->packetizer, payloadName, &sdp, config_bytes, config_size);
		gf_free(config_bytes);
		gf_dynstrcat(out_sdp_buffer, sdp, NULL);
		gf_dynstrcat(out_sdp_buffer, "\n", NULL);
		if (sdp) gf_free(sdp);
	}
	return GF_OK;
}



GF_EXPORT
char *gf_rtp_streamer_format_sdp_header(char *app_name, char *ip_dest, char *session_name, char *iod64)
{
	u64 size;
	char *sdp, *tmp_fn = NULL;
	FILE *tmp = gf_file_temp(&tmp_fn);
	if (!tmp) return NULL;

	/* write SDP header*/
	gf_fprintf(tmp, "v=0\n");
	gf_fprintf(tmp, "o=%s 3326096807 1117107880000 IN IP%d %s\n", app_name, gf_net_is_ipv6(ip_dest) ? 6 : 4, ip_dest);
	gf_fprintf(tmp, "s=%s\n", (session_name ? session_name : "GPAC Scene Streaming Session"));
	gf_fprintf(tmp, "c=IN IP%d %s\n", gf_net_is_ipv6(ip_dest) ? 6 : 4, ip_dest);
	gf_fprintf(tmp, "t=0 0\n");

	if (iod64)
		gf_fprintf(tmp, "a=mpeg4-iod:\"data:application/mpeg4-iod;base64,%s\"\n", iod64);

	size = gf_fsize(tmp);
	sdp = (char*)gf_malloc(sizeof(char) * (size_t)(size+1));
	size = gf_fread(sdp, (size_t)size, tmp);
	sdp[size] = 0;
	gf_fclose(tmp);
	gf_file_delete(tmp_fn);
	gf_free(tmp_fn);
	return sdp;
}

GF_EXPORT
GF_Err gf_rtp_streamer_append_sdp(GF_RTPStreamer *rtp, u16 ESID, const u8 *dsi, u32 dsi_len, char *KMS_URI, char **out_sdp_buffer)
{
	return gf_rtp_streamer_append_sdp_extended(rtp, ESID, dsi, dsi_len, NULL, 0, KMS_URI, 0, 0, 0, 0, 0, 0, 0, 0, GF_FALSE, out_sdp_buffer);
}

GF_EXPORT
GF_Err gf_rtp_streamer_send_data(GF_RTPStreamer *rtp, u8 *data, u32 size, u32 fullsize, u64 cts, u64 dts, Bool is_rap, Bool au_start, Bool au_end, u32 au_sn, u32 sampleDuration, u32 sampleDescIndex)
{
	GF_Err e;
	if (!rtp->channel) return data ? GF_BAD_PARAM : GF_EOS;

	rtp->packetizer->sl_header.compositionTimeStamp = gf_timestamp_rescale(cts, rtp->in_timescale, rtp->channel->TimeScale);
	rtp->packetizer->sl_header.decodingTimeStamp = gf_timestamp_rescale(dts, rtp->in_timescale, rtp->channel->TimeScale);
	rtp->packetizer->sl_header.randomAccessPointFlag = is_rap;
	rtp->packetizer->sl_header.accessUnitStartFlag = au_start;
	rtp->packetizer->sl_header.accessUnitEndFlag = au_end;
	rtp->packetizer->sl_header.AU_sequenceNumber = au_sn;
	sampleDuration = (u32) gf_timestamp_rescale(sampleDuration, rtp->in_timescale, rtp->channel->TimeScale);
	if (au_start && size) rtp->packetizer->nb_aus++;

	rtp->last_err = GF_OK;
	e = gf_rtp_builder_process(rtp->packetizer, data, size, (u8) au_end, fullsize, sampleDuration, sampleDescIndex);
	if (e) return e;
	return rtp->last_err;
}

GF_EXPORT
GF_Err gf_rtp_streamer_send_au(GF_RTPStreamer *rtp, u8 *data, u32 size, u64 cts, u64 dts, Bool is_rap)
{
	return gf_rtp_streamer_send_data(rtp, data, size, size, cts, dts, is_rap, GF_TRUE, GF_TRUE, 0, 0, 0);
}

GF_EXPORT
GF_Err gf_rtp_streamer_send_au_with_sn(GF_RTPStreamer *rtp, u8 *data, u32 size, u64 cts, u64 dts, Bool is_rap, u32 inc_au_sn)
{
	if (inc_au_sn) rtp->packetizer->sl_header.AU_sequenceNumber += inc_au_sn;
	return gf_rtp_streamer_send_data(rtp, data, size, size, cts, dts, is_rap, GF_TRUE, GF_TRUE, rtp->packetizer->sl_header.AU_sequenceNumber, 0, 0);
}

GF_EXPORT
void gf_rtp_streamer_disable_auto_rtcp(GF_RTPStreamer *streamer)
{
	streamer->channel->no_auto_rtcp = GF_TRUE;
}

GF_EXPORT
GF_Err gf_rtp_streamer_send_rtcp(GF_RTPStreamer *streamer, Bool force_ts, u32 rtp_ts, u32 force_ntp_type, u32 ntp_sec, u32 ntp_frac)
{
	if (force_ts) streamer->channel->last_pck_ts = rtp_ts;
	if (force_ntp_type) {
		streamer->channel->forced_ntp_sec = ntp_sec;
		streamer->channel->forced_ntp_frac = ntp_frac;
		if (force_ntp_type==2) {
			streamer->channel->next_report_time = 0;
		}
		//we are sendind RTCP before first packet was sent, set sent time to same values
		if (!streamer->channel->last_pck_ntp_sec) {
			streamer->channel->last_pck_ntp_sec = ntp_sec;
			streamer->channel->last_pck_ntp_frac = ntp_frac;
		}
	} else {
		streamer->channel->forced_ntp_sec = 0;
		streamer->channel->forced_ntp_frac = 0;
	}

	GF_Err e = gf_rtp_send_rtcp_report(streamer->channel);
	if (force_ntp_type) {
		streamer->channel->forced_ntp_sec = 0;
		streamer->channel->forced_ntp_frac = 0;
	}
	return e;
}

GF_EXPORT
GF_Err gf_rtp_streamer_send_bye(GF_RTPStreamer *streamer)
{
	if (!streamer->channel) return GF_OK;
	return gf_rtp_send_bye(streamer->channel);
}

GF_EXPORT
u8 gf_rtp_streamer_get_payload_type(GF_RTPStreamer *streamer)
{
	return streamer ? streamer->packetizer->PayloadType : 0;
}

GF_EXPORT
u16 gf_rtp_streamer_get_next_rtp_sn(GF_RTPStreamer *streamer)
{
	return streamer->packetizer->rtp_header.SequenceNumber+1;
}

GF_EXPORT
GF_Err gf_rtp_streamer_set_interleave_callbacks(GF_RTPStreamer *streamer, gf_rtp_tcp_callback RTP_TCPCallback, void *cbk1, void *cbk2)
{

 	return gf_rtp_set_interleave_callbacks(streamer->channel, RTP_TCPCallback, cbk1, cbk2);
}

GF_EXPORT
GF_Err gf_rtp_streamer_read_rtcp(GF_RTPStreamer *streamer, gf_rtcp_rr_callback rtcp_cbk, void *udta)
{
	u32 i, frac, sec;
	u32 size = gf_rtp_read_rtcp(streamer->channel, streamer->rtcp_buf, RTCP_BUF_SIZE);
	if (!size || !rtcp_cbk) return GF_EOS;

	gf_net_get_ntp(&sec, &frac);
	GF_Err e = gf_rtp_decode_rtcp(streamer->channel, streamer->rtcp_buf, size, NULL);
	if (e<0) return e;

	for (i=0; i<streamer->channel->nb_rctp_rr; i++) {
		GF_RTCP_Report *rr = &streamer->channel->rtcp_rr[i];
		u32 ssrc = (rr->ssrc==streamer->channel->SSRC) ? 0 : rr->ssrc;
		u32 lsr_sec = rr->last_sr>>16;
		u32 lsr_frac = (rr->last_sr&0xFFFF)<<16;
		u64 dlsr = rr->delay_last_sr * 1000;
		dlsr /= 65536;
		s64 diff = (sec&0x0000FFFF) * 1000;
		diff -= lsr_sec*1000;
		diff += ((frac>>16)*1000)/65536;
		diff -= (lsr_frac*1000)/65536;
		diff -= dlsr;

		u32 rtt_ms = (diff>=0) ? (u32) diff : 0;
		u32 loss_rate = (rr->frac_lost*1000)/255;

		rtcp_cbk(udta, ssrc, rtt_ms, rr->jitter, loss_rate);
	}
	return GF_OK;
}

GF_EXPORT
u32 gf_rtp_streamer_get_ssrc(GF_RTPStreamer *streamer)
{
	return (streamer && streamer->channel) ? streamer->channel->SSRC : 0;
}

GF_EXPORT
u32 gf_rtp_streamer_get_timescale(GF_RTPStreamer *streamer)
{
	return (streamer && streamer->packetizer) ? streamer->packetizer->sl_config.timestampResolution : 0;
}

GF_EXPORT
u32 gf_rtp_streamer_get_codecid(GF_RTPStreamer *streamer)
{
	return (streamer && streamer->packetizer) ? streamer->packetizer->slMap.CodecID : 0 ;
}

#endif /*GPAC_DISABLE_STREAMING && GPAC_DISABLE_ISOM*/

