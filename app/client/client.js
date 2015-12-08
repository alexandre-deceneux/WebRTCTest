function initCaller(messageCallback, mentorCallback){
    var RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription;
    var RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    var RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate;
    var wsUri = "ws://localhost:8090/";

    var uid = Math.round(Math.random() * 100000000000);
    console.log("Connected as " + uid);
    var signalingChannel = createSignalingChannel(wsUri, uid);
    var servers = { iceServers: [{urls: "stun:stun.1.google.com:19302"}]};
    var channels = {};
    var receiver = null;

    function initCommunication() {
        signalingChannel.onMentor = function(mentor){
            i = 0;
            for (var elem in mentor) {
                setTimeout(function(elem){
                    console.log("Create comm with ", mentor[elem]);
                    startCommunication(mentor[elem]);
                }, i, elem);
                i += 300;
            }
        };
        signalingChannel.onClientDisconnected = function(clientid){
            delete channels[clientid];
            mentorCallback(channels);
        };
        signalingChannel.onOffer = function (offer, source) {
            console.log('receive offer from');
            var peerConnection = createPeerConnection(source);
            peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            peerConnection.createAnswer(function(answer){
                peerConnection.setLocalDescription(answer);
                console.log('send answer');
                signalingChannel.sendAnswer(answer, source);
            }, function (e){
                console.error(e);
            });
        };
    }

    function createPeerConnection(peerId){
        var pc = new RTCPeerConnection(servers, {
            optional: [{
                DtlsSrtpKeyAgreement: true
            }]
        });
        pc.onicecandidate = function (evt) {
            if(evt.candidate){ // empty candidate (wirth evt.candidate === null) are often generated
                signalingChannel.sendICECandidate(evt.candidate, peerId);
            }
        };
        signalingChannel.onICECandidate = function (ICECandidate, source) {
            console.log("receiving ICE candidate from ",source);
            pc.addIceCandidate(new RTCIceCandidate(ICECandidate));
        };
        pc.ondatachannel = function(event) {
            var receiveChannel = event.channel;
            channels[peerId] = receiveChannel;
            mentorCallback(channels);
            receiveChannel.onmessage = function(event){
                onRTCMessage(event.data);
            };
        };
        return pc;
    }

    function startCommunication(peerId) {
        var pc = new RTCPeerConnection(servers, {
            optional: [{
                DtlsSrtpKeyAgreement: true
            }]
        });
        pc.onicecandidate = function (evt) {
            if(evt.candidate){
                signalingChannel.sendICECandidate(evt.candidate, peerId);
            }
        };
        signalingChannel.onAnswer = function (answer, source) {
            console.log('receive answer from ', source);
            pc.setRemoteDescription(new RTCSessionDescription(answer));
        };
        signalingChannel.onICECandidate = function (ICECandidate, source) {
            console.log("receiving ICE candidate from ",source);
            pc.addIceCandidate(new RTCIceCandidate(ICECandidate));
        };
        //:warning the dataChannel must be opened BEFORE creating the offer.
        var _commChannel = pc.createDataChannel('communication' + peerId + "-" + uid, {
            reliable: false
        });
        channels[peerId] = _commChannel;
        mentorCallback(channels);

        _commChannel.onclose = function(evt) {
            console.log("dataChannel closed");
        };
        _commChannel.onerror = function(evt) {
            console.error("dataChannel error");
        };
        _commChannel.onopen = function(){
            console.log("dataChannel opened");
        };
        _commChannel.onmessage = function(message){
            onRTCMessage(message.data);
        };
        pc.createOffer(function(offer){
            pc.setLocalDescription(offer);
            console.log('send offer');
            signalingChannel.sendOffer(offer, peerId);
        }, function (e){
            console.error(e);
        });
    }

    function setReceiver(rcv){
        receiver = rcv;
    }
    function sendRTCMessage(msg){
        if (receiver != null)
            channels[receiver].send(JSON.stringify({type:'msg', message:msg}));
    }

    function onRTCMessage(msg){
        var messageObj = JSON.parse(msg);
        if (messageObj.type == "msg")
            messageCallback(messageObj.message);
    }

    window.sendRTCMessage = sendRTCMessage;
    window.setReceiver = setReceiver;
    initCommunication();
}
