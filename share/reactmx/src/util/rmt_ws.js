

let RMT_WS = (function() {

    function RMT_WS(address) {

        this.address = address;
        this.ws = null;
        this.OnGPACMsg = null;

        this.Connect = function() {
            if (this.ws) {
                this.ws.close();
            }

            this.ws = new WebSocket(this.address);
            this.ws.binaryType = "arraybuffer";

            this.ws.onopen = OnConnect.bind(this);
            this.ws.onmessage = OnMessage.bind(this);
            this.ws.onclose = OnClose.bind(this);
            this.ws.onerror = OnError.bind(this);

        }

        this.GetDetails = function(idx) {
            console.log("Asking for details of idx " + idx);
            SendMessage(this, {'message': "get_details", 'idx': idx} );
        }

        this.StopDetails = function(idx) {
            console.log("Stopping details of idx " + idx);
            SendMessage(this, {'message': "stop_details", 'idx': idx} );
        }

        this.UpdateFilterArg = function(filterIdx, filterName, argName, argNewValue) {
            console.log("updating filter ", filterName, filterIdx, " arg ", argName, " = ", argNewValue);
            SendMessage(this, {
                'message' : "update_arg",
                'idx' : filterIdx,
                'name' : filterName,
                'argName' : argName,
                'newValue' : argNewValue
            })
        }


        this.RequestPNG = function(filter) {
            console.log("Requesting PNG for filter ", filter.name, filter.idx);
            SendMessage(this, {
                'message' : "get_png",
                'idx' : filter.idx,
                'name' : filter.name,
            })
        }

    }


    function SendMessage(self, msg) {
        if (self.ws)
            self.ws.send("json:" + JSON.stringify(msg));
    }

    function OnConnect() {

        console.log("on connect handler");
        SendMessage(this, {'message': "get_all_filters"} );
    }


    function OnClose() {

        console.log("OnClose handler");
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws = null;

    }

    function OnError(event) {
        console.log("on error handler:", event);
    }

    function OnMessage(msg) {

        if (typeof(msg.data)!="string")
            return

        let jmsg = {};

        try {
            jmsg = JSON.parse(msg.data);
        }
        catch(e) {
            console.log("JSON parse error in OnMessage on message: ", msg);
            return;
        }
        if ("message" in jmsg && this.OnGPACMsg) {
            this.OnGPACMsg(jmsg);
        }

    }


    return RMT_WS;
})();


module.exports = RMT_WS
