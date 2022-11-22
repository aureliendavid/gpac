
let DataViewReader = require('./DataViewReader');
let WebSocketConnection = require('./WebSocketConnection');

let Gemotery = (function() {

    function Gemotery(address) {

        this.address = address;
        this.ws = new WebSocketConnection();

        // this.ws.AddConnectHandler(Bind(OnConnect, this));
        // this.ws.AddMessageHandler("LOGM", Bind(OnRemoteryLOGM, this));
        // this.ws.AddMessageHandler("PING", Bind(OnRemoteryPING, this));
        // this.ws.AddMessageHandler("SMPL", Bind(OnRemoterySMPL, this));
        // this.ws.AddDefaultMessageHandler(Bind(OnRemoteryText, this));

        this.ws.AddConnectHandler(OnConnect.bind(this));
        this.ws.AddMessageHandler("LOGM", OnRemoteryLOGM.bind(this));
        this.ws.AddMessageHandler("PING", OnRemoteryPING.bind(this));
        this.ws.AddMessageHandler("SMPL", OnRemoterySMPL.bind(this));
        this.ws.AddDefaultMessageHandler(OnRemoteryText.bind(this));

        this.OnGPACMsg = null;

        this.Connect = function() {
            this.ws.Connect(address);
        }

        this.GetDetails = function(idx) {
            console.log("Asking for details of idx " + idx);
            SendMessage(this, {'message': "get_details", 'idx': idx} );
        }

        this.StopDetails = function(idx) {
            console.log("Stopping details of idx " + idx);
            SendMessage(this, {'message': "stop_details", 'idx': idx} );
        }

    }


    function OnConnect() {

        console.log("on connect handler");
        SendMessage(this, {'message': "get_all_filters"} );
    }

    function SendMessage(self, msg) {
        self.ws.Send("CONI" + "json:" + JSON.stringify(msg));
    }

    function OnRemoteryText(ws, data_view) {

        var data_view_reader = new DataViewReader(data_view, 0);
        var text = data_view_reader.GetText();

        if (text.length <= 0)
            return;

        //console.log(text);
        let jmsg = {};

        try {
            jmsg = JSON.parse(text);
        }
        catch(e) {
            console.log("JSON parse error in OnRemoteryText on message: " + text);
            return;
        }
        if ("message" in jmsg && this.OnGPACMsg) {
            this.OnGPACMsg(jmsg);
        }



    }

    function OnRemoteryPING(ws, data_view) {
    }
    function OnRemoterySMPL(ws, data_view) {
    }

    function OnRemoteryLOGM(ws, data_view) {

    }




    return Gemotery;
})();


module.exports = Gemotery
