var bopclient, topoviewer; 
BOPlishClient.config.connectionManager.pcoptions = {iceServers:[{url:'stun:stun.l.google.com:19302'}]};
BOPlishClient.config.chord.fixFingersInterval = 250;

$(document).ready(function() {
	$('[data-toggle=FingerTableToggle]').click(function(ev) {
		ev.preventDefault();
		$('#fingerTable').toggleClass('in');
		if ($('#fingerTable').hasClass('in')) {
			$('#scribe-fingerTabletoggle').html('Hide Finger Table');
		} else {
			$('#scribe-fingerTabletoggle').html('Show Finger Table');
		}
	});
	bopclient = new BOPlishClient('ws://' + document.location.host, function() {
		setInterval(updateStuff, 1000);
		var topoProtocol = new TopologyDiscover(bopclient);
		topoviewer = new TopologyViewer(bopclient, topoProtocol, '#topo-svg');
	}, function(msg){
		console.log('error', msg);
	});
});

function updateStuff() {
	var bopid = bopclient.bopid;
	var id = document.title = bopclient._router._localNode.id().toString().replace(/^[0]+/g,"");
	var pre = bopclient._router._localNode.predecessor_id().toString().replace(/^[0]+/g,"");
	var suc = bopclient._router._localNode.successor_id().toString().replace(/^[0]+/g,"");;
	$('.scribe-bopId').html(bopid);
	$('.scribe-peerId').html(id);
	$('.scribe-peerIdPredecessor').html(pre);
	$('.scribe-peerIdSuccessor').html(suc);
	//$('.scribe-allSubscriptions').html(bopclient._scribe._getSubscriptions().join(', '));
	//$('.scribe-mySubscriptions').html(myProto.group.getSubscriptions().join(', '));
	var fingerTable = bopclient._router.getFingerTable();
	$('#fingerTable tbody > tr').remove();
	var columnIndex = -1;
	fingerTable.forEach(function(item, index) {
		if (index % 4 === 0) {
			columnIndex++;
		}
		$('#fingerTable' + columnIndex).find('tbody')
			.append($('<tr>')
			.append(
				$('<td>').text(index + 1),
				$('<td>').text(item.start.replace(/^[0]+/g,"")),
				$('<td>').text(item.successor.replace(/^[0]+/g,""))
			)
		);
	});
}