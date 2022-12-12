import * as evg from 'evg'
import { Sys as sys } from 'gpaccore'

session.rmt_sampling = false;




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
			sys.sleep(50);
			send_all_filters();
		}
} );

session.set_del_filter_fun( (f) => {
	print("delete filter " + f.iname);
	let idx = all_filters.indexOf(f);
	if (idx>=0)
		all_filters.splice(idx, 1);
	if (draned_once) {
		sys.sleep(50);
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