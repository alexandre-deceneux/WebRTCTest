function initCaller(messageCallback, mentorCallback){
    var RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription;
    var RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    var RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate;
    var wsUri = "ws://localhost:8090/";

    var uid = Math.round(Math.random() * 100000000000);
    console.log("Connected as " + uid);
    var signalingChannel = createSignalingChannel(wsUri, uid);
    var servers = { iceServers: [{urls: "stun:stun.1.google.com:19302"}]};

    function initCommunication() {
        signalingChannel.onMentor = function(mentor){
            mentorCallback(mentor);
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
            console.log("channel received");
            window.channel = receiveChannel;
            receiveChannel.onmessage = function(event){
                messageCallback(event.data);
            };
        };
        return pc;
    }
    signalingChannel.onOffer = function (offer, source) {
        console.log('receive offer');
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

    function startCommunication(peerId) {
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
        signalingChannel.onAnswer = function (answer, source) {
            console.log('receive answer from ', source);
            pc.setRemoteDescription(new RTCSessionDescription(answer));
        };
        signalingChannel.onICECandidate = function (ICECandidate, source) {
            console.log("receiving ICE candidate from ",source);
            pc.addIceCandidate(new RTCIceCandidate(ICECandidate));
        };
        //:warning the dataChannel must be opened BEFORE creating the offer.
        var _commChannel = pc.createDataChannel('communication', {
            reliable: false
        });
        pc.createOffer(function(offer){
            pc.setLocalDescription(offer);
            console.log('send offer');
            signalingChannel.sendOffer(offer, peerId);
        }, function (e){
            console.error(e);
        });
        window.channel = _commChannel;
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
            messageCallback(message.data);
        };
    }

    window.startCommunication = startCommunication;
    initCommunication();
}
