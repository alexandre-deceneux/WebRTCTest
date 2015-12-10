function initCaller(messageCallback, mentorCallback){
    var RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription;
    var RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    var RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate;
    var wsUri = "ws://localhost:8090/";

    var uid = Math.round(Math.random() * 100000000000);
    var signalingChannel = createSignalingChannel(wsUri, uid);
    var servers = { iceServers: [{urls: "stun:stun.1.google.com:19302"}]};
    var channels = {};
    var peerIdList = [];
    var receiver = null;

    /**
     * Initiate the signaling server communication
     */
    function initCommunication() {
        signalingChannel.onMentor = function(mentor){
            peerIdList.push(mentor);
            startCommunication(mentor, true);
        };
        signalingChannel.onClientDisconnected = function(clientid){
            delete channels[clientid];
            mentorCallback(channels);
        };
        signalingChannel.onOffer = function (offer, source) {
            var peerConnection = createPeerConnection(source);
            peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            peerConnection.createAnswer(function(answer){
                peerConnection.setLocalDescription(answer);
                signalingChannel.sendAnswer(answer, source);
            }, function (e){
                console.error(e);
            });
        };
    }

    /**
     * Initiate the communication (receiver part)
     * @param peerId Caller id
     */
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
            pc.addIceCandidate(new RTCIceCandidate(ICECandidate));
        };
        pc.ondatachannel = function(event) {
            var receiveChannel = event.channel;
            channels[peerId] = receiveChannel;
            peerIdList.push(peerId);
            mentorCallback(channels);
            receiveChannel.onmessage = function(event){
                onRTCMessage(event.data, peerId);
            };
        };
        return pc;
    }

    /**
     * Start a communication with a peer
     * @param peerId Peer ID to connect to
     * @param isMentor True if the ID is the current mentor
     */
    function startCommunication(peerId, isMentor) {
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
            pc.setRemoteDescription(new RTCSessionDescription(answer));
        };
        signalingChannel.onICECandidate = function (ICECandidate, source) {
            pc.addIceCandidate(new RTCIceCandidate(ICECandidate));
        };
        //:warning the dataChannel must be opened BEFORE creating the offer.
        var _commChannel = pc.createDataChannel('communication' + peerId + "-" + uid, {
            reliable: false
        });
        channels[peerId] = _commChannel;
        mentorCallback(channels);

        _commChannel.onopen = function(){
            if (isMentor)
                _commChannel.send(JSON.stringify({type: 'getpeerlist'}));
        };
        _commChannel.onmessage = function(message){
            onRTCMessage(message.data, peerId);
        };
        pc.createOffer(function(offer){
            pc.setLocalDescription(offer);
            signalingChannel.sendOffer(offer, peerId);
        }, function (e){
            console.error(e);
        });
    }

    /**
     * Set a new id as receiver
     * @param rcv The new receiver
     */
    function setReceiver(rcv){
        receiver = rcv;
    }

    /**
     * Send an RTC message to a peer
     * @param msg Message to send
     */
    function sendRTCMessage(msg){
        if (receiver != null)
            channels[receiver].send(JSON.stringify({type:'msg', message:msg}));
    }

    /**
     * Add new peers to the current list. Establish the communication
     * @param newList
     */
    function addToPeerList(newList){
        i = 0;
        for (var elem in newList)
            if (newList[elem] != uid && peerIdList.indexOf(newList[elem]) == -1) {
                        setTimeout(function (elem) {
                            startCommunication(newList[elem], false);
                        }, i, elem);
                        i += 300;
            }
        peerIdList = peerIdList.concat(newList);
    }

    /**
     * Send the current peer list
     * @param receiver The peer ID to send the list to
     */
    function sendPeerList(receiver){
        channels[receiver].send(JSON.stringify({type:'peerlist', list:peerIdList}));
    }

    /**
     * Analyze an RTC message
     * @param msg Message formated
     * @param sender The sender ID if any
     */
    function onRTCMessage(msg, sender){
        var messageObj = JSON.parse(msg);
        if (messageObj.type == "msg")
            messageCallback(messageObj.message);
        else if (messageObj.type == "peerlist")
            addToPeerList(messageObj.list);
        else if (messageObj.type == "getpeerlist")
            sendPeerList(sender);
    }

    window.sendRTCMessage = sendRTCMessage;
    window.setReceiver = setReceiver;
    initCommunication();
}
