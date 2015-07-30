var Bacon = require('baconjs')
var carrier = require('carrier')
var net = require('net')
var winston = require('winston')
var request = require('request')
winston.remove(winston.transports.Console)

winston.add(winston.transports.Console, {
  timestamp: (function() {
    return new Date()
  })
})

console.log = winston.info

var houmioBridge = process.env.HOUMIO_BRIDGE || "192.168.2.110:3001"
var pilightBridge = process.env.pilight_BRIDGE || '192.168.2.105:5001'
console.log("houmioBridge:", houmioBridge, "pilightBridge:", pilightBridge)

var state = function(device, state){
  var cmd = {
    action: "control",
    code: {
      device: device,
      state: state
    }
  }

  request.get('http://' + pilightBridge + '/send?' + encodeURIComponent(JSON.stringify(cmd)), function(err, res, body){
    if(err || res.statusCode !== 200){
      console.log(err, body, err? null : res.statusCode)
    }
  })
}

var toLines = function(socket) {
  return Bacon.fromBinder(function(sink){
    carrier.carry(socket, sink)

    socket.on("close", function() {
      return sink(new Bacon.End())
    })

    socket.on("error", function(err) {
      return sink(new Bacon.Error(err))
    })

    return function(){}
  })
}

var isWriteMessage = function(message){
  return message.command === "write"
}

var writeMessagesTopilight = function(bridgeSocket){
  return toLines(bridgeSocket)
  .map(JSON.parse)
  .filter(isWriteMessage)
  .onValue(function(msg){
    state(msg.data.protocolAddress, msg.data.on ? 'on' : 'off')
  })
}

var connectBridge = function() {
    var bridgeSocket = new net.Socket()
    bridgeSocket.connect(houmioBridge.split(":")[1], houmioBridge.split(":")[0], function(){
      writeMessagesTopilight(bridgeSocket)
      return bridgeSocket.write((JSON.stringify({
        command: "driverReady",
        protocol: "pilight"
      })) + "\n")
    })
}

connectBridge()
