import * as evg from 'evg'
import { Sys as sys } from 'gpaccore'

import { FileIO as FileIO } from 'gpaccore'
import { File as File } from 'gpaccore'

// import {dst} from 'filewrap.js'

session.rmt_sampling = false;

let probefilter = null;

///////////////////////////////////// FILE IO //////////////////////////////////////////////////////////////////////////////

///
function base64ArrayBuffer(arrayBuffer) {
	var base64    = ''
	var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

	var bytes         = new Uint8Array(arrayBuffer)
	var byteLength    = bytes.byteLength
	var byteRemainder = byteLength % 3
	var mainLength    = byteLength - byteRemainder

	var a, b, c, d
	var chunk

	// Main loop deals with bytes in chunks of 3
	for (var i = 0; i < mainLength; i = i + 3) {
	  // Combine the three bytes into a single integer
	  chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

	  // Use bitmasks to extract 6-bit segments from the triplet
	  a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
	  b = (chunk & 258048)   >> 12 // 258048   = (2^6 - 1) << 12
	  c = (chunk & 4032)     >>  6 // 4032     = (2^6 - 1) << 6
	  d = chunk & 63               // 63       = 2^6 - 1

	  // Convert the raw binary segments to the appropriate ASCII encoding
	  base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
	}

	// Deal with the remaining bytes and padding
	if (byteRemainder == 1) {
	  chunk = bytes[mainLength]

	  a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

	  // Set the 4 least significant bits to zero
	  b = (chunk & 3)   << 4 // 3   = 2^2 - 1

	  base64 += encodings[a] + encodings[b] + '=='
	} else if (byteRemainder == 2) {
	  chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

	  a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
	  b = (chunk & 1008)  >>  4 // 1008  = (2^6 - 1) << 4

	  // Set the 2 least significant bits to zero
	  c = (chunk & 15)    <<  2 // 15    = 2^4 - 1

	  base64 += encodings[a] + encodings[b] + encodings[c] + '='
	}

	return base64
  }
////


function _arrayBufferToStr( buffer ) {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return binary;
}

function  _arrayBufferToBase64( buffer ) {

    return btoa( _arrayBufferToStr(buffer) );
}

let dst = new FileIO(
	"xxxxxxxxxx.png",
	//open
	function(url, mode) {
		this.target = new File(url, mode);
		this.written = false;
		console.log("opened file")
		return true;
	},
	//close
	function() {
		console.log("closing file with written = " + JSON.stringify(this.written) + " and probe = " + JSON.stringify(gpac_filter_to_object(probefilter, true)))
		this.target.close();
		if (probefilter && this.written) {
			console.log("removing probe " + JSON.stringify(gpac_filter_to_object(probefilter)));
			probefilter.remove()
			probefilter = null;
		}
	},
	//write
	function(buf)
	{
		var base64String = base64ArrayBuffer(buf);
		console.log("writing to file : " + base64String.substring(0, 64));
		this.written = true;
		return this.target.write(buf);
	},
	//read
	function(buf)
	{
		let res =  this.target.read(buf);
		console.log("reading from file"  + res);
		return res;
	},
	//seek
	function(offset, whence)
	{
		console.log("seek in file ", offset, whence);
		return this.target.seek(offset, whence);
	},
	//tell
	function()
	{
		console.log("tell file pos");
		return this.target.pos;
	},
	//eof
	function()
	{
		console.log("check file eof");
		return this.target.eof;
	},
	//exists
	function(url)
	{
		console.log("check file exists");
		return sys.file_exists(url);
	}
	);





////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let all_filters = [];
let all_connected = false;

let details_needed = {};

session.reporting(true);

session.set_rmt_fun( (text)=> {
	//print("rmt says " + text);

	if (text.startsWith("json:")) {
		try {
			let jtext = JSON.parse(text.substr(5));
			if (!('message' in jtext)) return;

			if ( jtext['message'] == 'get_all_filters' ) {
				print("Sending all filters when ready");
				send_all_filters();

			}

			if ( jtext['message'] == 'get_details' ) {
				let idx = jtext['idx'];
				print("Details requested for idx " + idx);
				details_needed[idx] = true;
				send_details(idx);
			}

			if ( jtext['message'] == 'stop_details' ) {
				let idx = jtext['idx'];
				print("Details stopped for idx " + idx);
				details_needed[idx] = false;
			}

			if ( jtext['message'] == 'update_arg' ) {
				print("Update arguments of ")
				print(JSON.stringify(jtext));
				update_filter_argument(jtext['idx'], jtext['name'], jtext['argName'], jtext['newValue'])
			}

			if ( jtext['message'] == 'get_png' ) {
				print("request png of ")
				print(JSON.stringify(jtext));
				add_png_probe(jtext['idx'], jtext['name']);
			}

		} catch(e) {
			console.log(e);
		}
	}
});


function update_filter_argument(idx, name, argName, newValue) {

	let filter = session.get_filter(''+idx); // force get by iname

	if (!filter || filter.name != name) {
		print("discrepency in filter names " + filter.name + " v. " + name);
	}
	else {
		filter.update(argName, newValue)
	}

}


function add_png_probe(idx, name) {

	let filter = session.get_filter(''+idx); // force get by iname

	if (!filter || filter.name != name) {
		print("discrepency in filter names " + filter.name + " v. " + name);
	}
	else {
		probefilter = filter.insert("dst="+dst.url+":osize=128x128:dur=33/1000");
		probefilter.tagged = "hideme";
		//let probefilter = session.add_filter("dst="+dst.url+":osize=128x128", filter);
		console.log("probe added :" + JSON.stringify(gpac_filter_to_object(probefilter)));
	}

}

function on_all_connected(cb) {

	session.post_task( ()=> {

		let local_connected = true;
		let all_js_filters = [];

		session.lock_filters(true);

		for (let i=0; i<session.nb_filters; i++) {
			let f = session.get_filter(i);

			if (f.is_destroyed()) continue;

			if (!f.nb_opid && !f.nb_ipid) {
				local_connected = false;
				print("Filter not connected: ");
				print(JSON.stringify(gpac_filter_to_object(f)));
				break;
			}

			all_js_filters.push(gpac_filter_to_object(f));
		}

		session.lock_filters(false);

		if (local_connected) {
			cb(all_js_filters); // should prop be inside the lock?
			draned_once = true;
			return false;
		}

		return 200;
	});

}

function send_details(idx) {

	session.post_task( ()=> {

		let js_filter = null;

		session.lock_filters(true);

		for (let i=0; i<session.nb_filters; i++) {
			let f = session.get_filter(i);

			if (f.idx == idx)
				js_filter = gpac_filter_to_object(f, true);
		}

		session.lock_filters(false);

		send_to_ws(JSON.stringify({ 'message': 'details', 'filter': js_filter }));

		return details_needed[idx] ? 500 : false;
	});

}

let png_added = false ;
let png_rm = 0;

function send_all_filters() {

	on_all_connected( (all_js_filters) => {

		print("----- all connected -----");
		print(JSON.stringify(all_js_filters, null, 1));
		print("-------------------------");
		//session.rmt_send("json:"+JSON.stringify({ 'message': 'filters', 'filters': all_js_filters }));
		send_to_ws(JSON.stringify({ 'message': 'filters', 'filters': all_js_filters }));


		// let custom = session.new_filter("MyTest");
		// custom.set_cap({id: "StreamType", value: "Video", in: true} );
		// custom.pids=[];
		// custom.configure_pid = function(pid)
		// {
		// 	if (this.pids.indexOf(pid)>=0)
		// 		return;

		// 	this.pids.push(pid);
		// 	let evt = new FilterEvent(GF_FEVT_PLAY);
		// 	evt.start_range = 0.0;
		// 	print(evt.start_range);
		// 	pid.send_event(evt);
		// 	print(GF_LOG_INFO, "PID" + pid.name + " configured");
		// }

		// custom.process = function(pid)
		// {
		// 	this.pids.forEach(function(pid) {
		// 	while (1) {
		// 		let pck = pid.get_packet();
		// 		if (!pck) break;
		// 		print(GF_LOG_INFO, "PID" + pid.name + " got packet DTS " + pck.dts + " CTS " + pck.cts + " SAP " + pck.sap + " size " + pck.size);
		// 		pid.drop_packet();
		// 	}
		// 	});
		// }
		// // custom.set_source(session.get_filter(6));

		//session.add_filter("dst=mx.png", session.get_filter(6))
		//session.add_filter("dst=mx.png")

		// let dasher = session.get_filter(4);
		// console.log(JSON.stringify(dasher));
		// dasher.update("template", "$File$UPDATEEEEEEDDDDD$Number$_dash$FS$$Number$");

		// dasher.insert("dst=voxdyng.png:start=50:dur=1/24");




		// if (!png_added) {
		// 	// session.get_filter(3).insert("dst=voxdyng.png:start=50:dur=1/24");
		// 	session.get_filter(3).insert("dst=voxdyng.png:osize=500x500");
		// 	png_added = true;

		// }



		session.post_task( ()=> {

			let js_filters = [];
			png_rm += 1;

			if (png_added && png_rm == 50) {
				session.get_filter(9).remove();
			}


			session.lock_filters(true);

			for (let i=0; i<session.nb_filters; i++) {
				let f = session.get_filter(i);
				js_filters.push(gpac_filter_to_object(f));
			}

			session.lock_filters(false);

			send_to_ws(JSON.stringify({ 'message': 'update', 'filters': js_filters }));



			return 100;
		});


	});
}





let filter_props_lite = ['name', 'status', 'bytes_done', 'type', 'ID', 'nb_ipid', 'nb_opid', 'idx']
let filter_args_lite = []
let pid_props_lite = []

function gpac_filter_to_object(f, full=false) {
	let jsf = {};

	for (let prop in f) {
		if (full || filter_props_lite.includes(prop))
			jsf[prop] = f[prop];
	}

	jsf['gpac_args'] = [] ; // filtrer par type de filtre ?

	if (full) {		//TODO: remove tmp hack to avoid pfmt error on ffenc
		let all_args = f.all_args(false); // full args
		// console.log(JSON.stringify(all_args));
		for (let arg of all_args) {
			if (arg && (full || filter_args_lite.includes(arg.name)))
				jsf['gpac_args'].push(arg)

		}
	}

	jsf['ipid'] = {};
	jsf['opid'] = {};

	for (let d=0; d<f.nb_ipid; d++) {
		let pidname = f.ipid_props(d, "name");
		let jspid = {};

		f.ipid_props(d, (name, type, val) => {
			if (full || pid_props_lite.includes(name))
				jspid[name] = {'type': type, 'val': val};

		});
		jspid["buffer"] = f.ipid_props(d, "buffer");
		jspid["buffer_total"] = f.ipid_props(d, "buffer_total");
		jspid['source_idx'] = f.ipid_source(d).idx;

		jsf['ipid'][pidname] = jspid;
	}

	for (let d=0; d<f.nb_opid; d++) {
		let pidname = f.opid_props(d, "name");
		let jspid = {};

		f.opid_props(d, (name, type, val) => {
			if (full || pid_props_lite.includes(name))
				jspid[name] = {'type': type, 'val': val};

		});
		jspid["buffer"] = f.opid_props(d, "buffer");
		jspid["buffer_total"] = f.opid_props(d, "buffer_total");
		jsf['opid'][pidname] = jspid;
	}

	return jsf;

}

let filter_uid = 0;
let draned_once = false;

session.set_new_filter_fun( (f) => {
		print("new filter " + f.name);
		f.idx = filter_uid++;
		f.iname = ''+f.idx;
		// let jsf = gpac_filter_to_object(f);
		// print(JSON.stringify(jsf, null, 2));
		all_filters.push(f);
		if (draned_once) {
			sys.sleep(100);
			send_all_filters();
		}
} );

session.set_del_filter_fun( (f) => {
	print("delete filter " + f.iname);
	let idx = all_filters.indexOf(f);
	if (idx>=0)
		all_filters.splice(idx, 1);
	if (draned_once) {
		sys.sleep(100);
		send_all_filters();
	}
});

session.set_event_fun( (evt) => {
	// print("Event: " + JSON.stringify(evt, null, 2));
	// if (evt.type != GF_FEVT_USER) return 0;
	//print("evt " + evt.name);
});




let msg_index = 0;
let max_idx = 10000;
let max_msglen = 800;

function send_to_ws(json_message) {

	// print("sending json_message " + msg_index + " " + json_message.substr(0, 40) + "...");
	// // print("sending json_message " + msg_index + " " + json_message);
	// let idx = msg_index;

	// msg_index = (msg_index + 1) % max_idx ;

	// let nbmsg = Math.ceil(json_message.length / max_msglen);
	// print("Need " + nbmsg + " messages");

	// for (let i=0 ; i<nbmsg ; i++) {
	// 	let final = (i+1==nbmsg) ? 1 : 0;
	// 	let msg = json_message.substr(i*max_msglen, max_msglen).replace('\n', '\r');
	// 	// print("sending: " + "json:" + idx + ":" + i + ":" + final + ":" + msg);
	// 	session.rmt_send("json:" + idx + ":" + i + ":" + final + ":" + msg);
	// }


	session.rmt_send(json_message);

}