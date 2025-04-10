//returns true if an element is visible.
function isVisible (ele) {
	return ele.offsetWidth > 0 && ele.offsetHeight > 0
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
	
	if( request.message == "clicked_OK" ) {							//insert data coming from frontend into boxes
	 if(request.passwords){
		var passwords = request.passwords;
		if(passwords){
			for(var i = 0; i < passwords.length; i++){
				pwdId[i].value = passwords[i];
				var inputEvent = new Event('input');
				pwdId[i].dispatchEvent(inputEvent);				//to simulate actual typing
				var keyupEvent = new Event('keyup');
				pwdId[i].dispatchEvent(keyupEvent)
			}
		}
		if(request.userID){
			if(passwords && textId[0]){
				textId[0].value = request.userID;			//insert user name
			}else{												//userId without pwd; find it and fill the last one
				textId = [];
				var inputElements = document.querySelectorAll("input[type='text'], input[type='email']");
				for(var i = 0; i < inputElements.length; i++){
					if(isVisible(inputElements[i])){						//only visible fields
						textId.push(inputElements[i])
					}
				}
				if(textId[0]) textId[textId.length - 1].value = request.userID
			}
		}
	 }
	 if(request.KLoutput){
		 var length = visibleEditable.length;
		 if(length > 0){
			 if(visibleEditable[length-1].type == 'textarea'){
				if(visibleEditable[length-1].value == '') visibleEditable[length-1].value = request.KLoutput.replace(/<br>/gi,'\n').replace(/<(.*?)>/gi,"")			
			 }else{
				if(visibleEditable[length-1].textContent == ''){				//KyberLock output only into empty box, so make sure data is added only once
					var injected = document.createElement('div');
					injected.innerHTML = request.KLoutput;
					visibleEditable[length-1].insertBefore(injected,visibleEditable[length-1].firstChild)
				}
			 }
		 }
	 }

		//tell the popup it can close
	  chrome.runtime.sendMessage({message: "done"})
	  
	}else if(request.message == "send_data"){						//data requested from a script already loaded
		sendData()
	}
  }
)

//to simulate keyup event, from http://www.howtocreate.co.uk. Currently not used
function keyUpHere(element){
	if( window.KeyEvent ) {
  		var evObj = document.createEvent('KeyEvents');
  		evObj.initKeyEvent( 'keyup', true, true, window, false, false, false, false, 13, 0 );
	} else {
 		var evObj = document.createEvent('UIEvents');
  		evObj.initUIEvent( 'keyup', true, true, window, 1 );
 		evObj.keyCode = 13;
	}
	element.dispatchEvent(evObj);
}

//to find KyberLock-generated material: pure base64 between == tags
function getKLstuff(text){
	text = text.replace(/==+/g,'==').replace(/\n/g,'');

	var	sections = text.split('=='),
		outStrings = [];

	if(sections.length > 1){
		for(var i = 1; i < sections.length - 1; i++){
			if(!sections[i].match(/[^0-9a-zA-Z+/]/)) outStrings.push(sections[i])			//pure base64
		}
	}
	return outStrings
}

//to acquire selected text.
function getSelectionText() {
    var text = "",
    	activeEl = document.activeElement;

	if(typeof activeEl.selectionStart == "number"){
        text = activeEl.value.slice(activeEl.selectionStart, activeEl.selectionEnd);
    } else if (window.getSelection) {
        text = window.getSelection().toString();
    }
    return text;
}

//to get the element that contains the current selection.
function getSelectedNode(){
    if (document.selection){
        return document.selection.createRange().parentElement();
	}else{
        var selection = window.getSelection();
        if (selection.rangeCount > 0){
            if(selection.toString()) return selection.getRangeAt(0).startContainer.parentNode;		//make sure it's not empty
		}
    }
}

//the rest executes upon loading or per request
function sendData(){
	//for password function, find passsword fields and others, for reading encrypted material, find stuff between == markers
	window.pwdId = [];										//global variables  that will be used later
	window.textId = [];
	window.visibleEditable = [];

	var inputElements = document.querySelectorAll("input"),
		userDone = false;

	for(var i = 0; i < inputElements.length; i++){		//this is to avoid counting boxes that are on the page but not visible
		if(isVisible(inputElements[i])){
			if(inputElements[i].type == 'password'){
				pwdId.push(inputElements[i])
				if(i > 0){								//detect single text or email input immediately before, skipping hidden inputs
					if(!userDone){
						var j = 1;
						while(!isVisible(inputElements[i-j]) && j < i)
						j++;
						if(inputElements[i-j].type == 'text' || inputElements[i-j].type == 'email'){
							textId = [inputElements[i-j]];
							userDone = true
						}
					}
				}
			}
		}
	}
		
	var editableElements = document.querySelectorAll('[contenteditable=true], textarea');    //to find large input boxes where to send encrypted stuff
	for(var i = 0; i < editableElements.length; i++){									//keep only visible elements
		if(isVisible(editableElements[i])){
			visibleEditable.push(editableElements[i]);
			if(editableElements[i].tagName.toLowerCase() == 'textarea'){			//empty out the box, so encrypted data is added only once
				editableElements[i].value = ''
			}else{
				editableElements[i].textContent = ''
			}
		}
	}

	var KLstuff = [getSelectionText()];						//selected text, otherwise base64 between "==" markers
	if(!KLstuff[0]){
		KLstuff = getKLstuff(document.body.innerText)		//innerText so it's only visible	 (doesn't work well with Yahoo)
	}else{
		pwdId = []										//ignore password boxes if a text is selected
	}

	//send data to the popup; some origins may be iframes with no host mentioned
	chrome.runtime.sendMessage({message: "start_info", host: document.location.host, websiteURL: document.location.href, number: pwdId.length, isUserId: userDone, KLstuff: KLstuff, largeInputs: visibleEditable.length})
}

//send data the fist time it loads
sendData()
