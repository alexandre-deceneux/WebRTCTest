var connectedPeers = {};
var peersId = [];
function onMessage(ws, message){
    var type = message.type;
    switch (type) {
        case "ICECandidate":
            onICECandidate(message.ICECandidate, message.destination, ws.id);
            break;
        case "offer":
            onOffer(message.offer, message.destination, ws.id);
            break;
        case "answer":
            onAnswer(message.answer, message.destination, ws.id);
            break;
        case "init":
            onInit(ws, message.init);
            break;
        default:
            throw new Error("invalid message type");
    }
}

function onInit(ws, id){
    console.log("init from peer:", id);
    ws.id = id;
    connectedPeers[id] = ws;
    if (peersId.length > 0) {
        ws.send(JSON.stringify({
            type: 'mentor',
            mentor:peersId[Math.round(Math.random() * (peersId.length - 1))]
        }));
    }
    peersId.push(id);
}

function onOffer(offer, destination, source){
    console.log("offer from peer:", source, "to peer", destination);
    try {
        connectedPeers[destination].send(JSON.stringify({
            type: 'offer',
            offer: offer,
            source: source
        }));
    }catch(e){
        disconnect(destination);
    }
}

function onAnswer(answer, destination, source){
    console.log("answer from peer:", source, "to peer", destination);
    connectedPeers[destination].send(JSON.stringify({
        type: 'answer',
        answer: answer,
        source: source
    }));
}

function onICECandidate(ICECandidate, destination, source){
    console.log("ICECandidate from peer:", source, "to peer", destination);
    try {
        connectedPeers[destination].send(JSON.stringify({
            type: 'ICECandidate',
            ICECandidate: ICECandidate,
            source: source
        }));
    } catch(e){
        disconnect(destination);
    }
}

function disconnect(id){
    var i = peersId.indexOf(id);
    if (i > -1) {
        delete connectedPeers[id];
        peersId.splice(i, 1);
        console.log(id, "disconnected");
    }
}

module.exports = onMessage;

module.exports.onDisconnect = disconnect;

//exporting for unit tests only
module.exports._connectedPeers = connectedPeers;
