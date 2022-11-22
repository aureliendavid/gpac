let DataViewReader = require('./DataViewReader');

let WebSocketConnection = (function()
{
	function WebSocketConnection()
	{
		this.MessageHandlers = { };
		this.Socket = null;
		this.Console = null;
	}


	WebSocketConnection.prototype.SetConsole = function(console)
	{
		this.Console = console;
	}


	WebSocketConnection.prototype.Connected = function()
	{
		// Will return true if the socket is also in the process of connecting
		return this.Socket != null;
	}


	WebSocketConnection.prototype.AddConnectHandler = function(handler)
	{
		this.AddMessageHandler("__OnConnect__", handler);
	}


	WebSocketConnection.prototype.AddDisconnectHandler = function(handler)
	{
		this.AddMessageHandler("__OnDisconnect__", handler);
	}


	WebSocketConnection.prototype.AddDefaultMessageHandler = function(handler)
	{
		this.AddMessageHandler("__default__", handler);
	}

	WebSocketConnection.prototype.AddMessageHandler = function(message_name, handler)
	{
		// Create the message handler array on-demand
		if (!(message_name in this.MessageHandlers))
			this.MessageHandlers[message_name] = [ ];
		this.MessageHandlers[message_name].push(handler);
	}

	WebSocketConnection.prototype.Connect = function(address)
	{
		// Disconnect if already connected
		if (this.Connected())
			this.Disconnect();

		Log(this, "Connecting to " + address);

		this.Socket = new WebSocket(address);
		this.Socket.binaryType = "arraybuffer";
		// this.Socket.onopen = Bind(OnOpen, this);
		// this.Socket.onmessage = Bind(OnMessage, this);
		// this.Socket.onclose = Bind(OnClose, this);
		// this.Socket.onerror = Bind(OnError, this);

		this.Socket.onopen = OnOpen.bind(this);
		this.Socket.onmessage = OnMessage.bind(this);
		this.Socket.onclose = OnClose.bind(this);
		this.Socket.onerror = OnError.bind(this);
	}


	WebSocketConnection.prototype.Disconnect = function()
	{
		Log(this, "Disconnecting");
		if (this.Connected())
			this.Socket.close();
	}


	WebSocketConnection.prototype.Send = function(msg)
	{
		if (this.Connected())
			this.Socket.send(msg);
	}


	function Log(self, message)
	{
		if (self.Console) {
			self.Console.Log(message);
		}
	}


	function CallMessageHandlers(self, message_name, data_view)
	{
		if (message_name in self.MessageHandlers)
		{
			var handlers = self.MessageHandlers[message_name];
			for (var i in handlers)
			    handlers[i](self, data_view);
		}
		else if ("__default__" in self.MessageHandlers)
			CallMessageHandlers(self, "__default__", data_view);
	}


	function OnOpen(event)
	{
		CallMessageHandlers(this, "__OnConnect__");
	}


	function OnClose(event)
	{
		console.log("OnClose ", this, event);
		// Clear all references
		this.Socket.onopen = null;
		this.Socket.onmessage = null;
		this.Socket.onclose = null;
		this.Socket.onerror = null;
		this.Socket = null;

		CallMessageHandlers(this, "__OnDisconnect__");
	}


	function OnError(event)
	{
		//Log(self, "Connection Error ");
	}


	function OnMessage(event)
	{
	    var data_view = new DataView(event.data);

	    var id = String.fromCharCode(
            data_view.getInt8(0),
            data_view.getInt8(1),
            data_view.getInt8(2),
            data_view.getInt8(3));

        CallMessageHandlers(this, id, data_view);
	}


	return WebSocketConnection;
})();

module.exports = WebSocketConnection;