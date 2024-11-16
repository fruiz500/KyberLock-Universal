//selects the encryption mode and starts it
function encrypt(){
	callKey = 'encrypt';
	if(stegoMode.checked){var lengthLimit = 10000}else{var lengthLimit = 71000};
	if(!chatMode.checked && composeBox.innerHTML.length > lengthLimit){
		var reply = confirm("This item is too long to be encrypted directly into the email and likely will be clipped by the server, rendering it undecryptable. We suggest to cancel and instead encrypt to file or to image, then attach the resulting file to your email");
		if(!reply) return
	}
	if(stegoMode.checked){
		var reply = enterCover();
		if(!reply) return
	}
	if(chatMode.checked){
		displayChat();
		return
	}else if(composeBox.innerHTML){		//sometimes imported text contains junk tags, so clean them out
		if(symMode.checked){															//if shared Pwd. mode, process is diverted ahead of key entry
			symmetricEncrypt(composeBox.textContent,false,false);
			return
		}
		for(var i = 0; i < emailList.length; i++) emailList[i] = emailList[i].trim();
		encryptList(emailList,false,false);
		isChatInvite = false;
		sharedPwd = '';
	}else{
		composeMsg.textContent = 'Nothing to encrypt'
	}
}

//selects the encryption mode and starts it, but outputs to file instead. Chat not an option
function encrypt2file(){
	callKey = 'encrypt2file';
	if(chatMode.checked){
		displayChat();
		return
	}else if(composeBox.innerHTML){
		if(symMode.checked){															//if shared Pwd. mode, process is diverted ahead of key entry
			symmetricEncrypt(composeBox.textContent,true,false);
			return
		}
		if(stegoMode.checked) enterCover();
		for(var i = 0; i < emailList.length; i++) emailList[i] = emailList[i].trim();
		encryptList(emailList,true,false);
		isChatInvite = false;
		sharedPwd = ''
	}else{
		composeMsg.textContent = 'Nothing to encrypt'
	}
}

//selects the encryption mode and starts it, but outputs to image instead. This function does prior encryption, to be followed by encoding
function encrypt2image(){
	callKey = 'encrypt2image';
	if(chatMode.checked){
		displayChat();
		return
	}else{
		if(symMode.checked){									//if shared Pwd. mode, process is diverted ahead of key entry
			symmetricEncrypt(composeBox.textContent,false,true);
			if(sharedPwd){
				stegoImageBox.value = sharedPwd;
				sharedPwd = ''
			}
			return
		}
		for(var i = 0; i < emailList.length; i++) emailList[i] = emailList[i].trim();
		encryptList(emailList,false,true);
		isChatInvite = false
	}
}

var text2decrypt = '';	

//function that starts it all when the read screen loads
function decrypt(){
	callKey = 'decrypt';
	var text = text2decrypt;
	text = text.replace(/<(.*?)>/gi,"");
	if(text.match('\u2004') || text.match('\u2005') || text.match('\u2006')) fromLetters(text);		//if hidden text
	if(text.match('\u00ad')) fromInvisible(text);
	decryptList();
	preserveKeys();		//especially needed in Read-once mode
	openChat()
}

//to concatenate a few Uint8Arrays fed as an array
function concatUi8(arrays) {
	var totalLength = 0;
	for(var i = 0; i < arrays.length; i++) totalLength += arrays[i].length;
	
	var result = new Uint8Array(totalLength);
  
	var length = 0;
	for(var i = 0; i < arrays.length; i++) {
	  result.set(arrays[i], length);
	  length += arrays[i].length;
	}
	return result
}

var inviteRequested = false;

//make an invitation. This only happens after the second button click
function inviteEncrypt(){
  var text = composeBox.innerHTML.trim();

  if(!text){							//if empty, make a backup
  	moveDB()

  }else{								//if there's text make an invitation
	if(!inviteRequested){				//sets flag so action happens on next click
		inviteRequested = true;
		composeMsg.textContent = "If you click *Invite* again, the contents of the box will be encrypted and added to a special invitation message. This message can be decrypted by anyone and is ";
		var blinker = document.createElement('span');
		blinker.className = "blink";
		blinker.textContent = "NOT SECURE";
		composeMsg.appendChild(blinker);
		inviteBtn.style.background = '#FB5216';
		setTimeout(function() {
			inviteRequested = false;
			inviteBtn.style.background = '#d9edff';
			composeMsg.textContent = 'Invite button disarmed';
			callKey = '';
		}, 10000)								//forget request after 10 seconds

	}else{
		callKey = 'inviteEncrypt';
		if(!refreshKey()) return;			//check that key is active and stop if not
		var nonce = crypto.getRandomValues(new Uint8Array(24));

		setTimeout(function(){composeMsg.textContent = "This invitation can be decrypted by anyone"},20);

		var output = myLock + '//////' + encodeBase64(concatUi8([[128],nonce,symEncrypt(text,nonce,myLockbin.slice(0,32),true)])).replace(/=+$/,'');		//key for invitations is the first 32 bytes of the sender's Lock
		output = output.match(/.{1,80}/g).join("\r\n");
		var outNode = document.createElement('div');	
		outNode.style.whiteSpace = "pre-line";			//so the line feeds format correctly
		outNode.innerHTML = "<p>The gibberish link below contains a message from me that has been encrypted with KyberLock Universal, To decrypt it, do this:</p><ol><li>Install the KyberLock Universal extension by following one of these links:</li><li>Reload your email and get back to this message.</li><li>Click the KyberLock logo above (green key). You will be asked to supply a secret Key, which will not be stored or sent anywhere. You must remember the secret Key, but you can change it later if you want.</li></ol><p>If you don't use Chrome or Firefox, or don't want to install an extension, you can also open the message in standalone KyberLock, available from https://kyberlock.com/app </p>";
		var initialTag = document.createElement('pre'),
			invBody = document.createElement('pre'),
			finalTag = document.createElement('pre');
		initialTag.textContent = "----------begin invitation message encrypted with KyberLock--------==";
		invBody.textContent = output;
		finalTag.textContent = "==---------end invitation message encrypted with KyberLock-----------";
		outNode.appendChild(initialTag);
		outNode.appendChild(invBody);
		outNode.appendChild(finalTag);

		if(typeof(isNewYahoo) == "undefined") outNode.contentEditable = 'true';

		insertInBody(outNode);
		inviteRequested = false;
		callKey = '';
		window.close()
	}
  }
}

//encrypts for a list of recipients, as emails in listArray. First makes a 256-bit message key, then gets the Lock for each recipient and encrypts the message key with it
//the output string contains each encrypted key along with 66 bits of an encrypted form of the recipient's Lock, so he/she can find the right encrypted key
//three modes: Anonymous, Signed, and ReadOnce
function encryptList(listArray,isFileOut,isImageOut){
	if(!refreshKey()) return;			//check that key is active and stop if not
	var encryptArray = [],
		inviteArray = [],
		myselfOnList = false;
	for (var index = 0; index < listArray.length; index++){		//scan email array to separate those in the directory from those that are not
		var email = listArray[index].trim();
		if (email != ''){
			if(email != myEmail){						//encrypt for myself is added later
				if(locDir[email]){
					if(locDir[email][0]){
						encryptArray.push(email)			//encrypt for these
					}else{
						inviteArray.push(email)
					}
				}else{
					inviteArray.push(email)			//make invites for these
				}
			}
		}
	}
	if(encryptArray.length == 0 && listArray.indexOf(myEmail) == -1){
		composeMsg.textContent = 'None of these recipients are in your directory. You should send them an invitation first.';
		return
	}else{
		composeMsg.textContent = 'Welcome to KyberLock'
	}
	if(!onceMode.checked) encryptArray.push(myEmail);				//copy to myself unless read-once
	encryptArray = shuffle(encryptArray);							//extra precaution
	var recipients = encryptArray.length;

	if(recipients == 0){
		composeMsg.textContent = 'No valid recipients for this mode';
		return
	}else if(recipients > 255){
		composeMsg.textContent = 'Maximum number of recipients is 255';
		return
	}

	var	msgKey = crypto.getRandomValues(new Uint8Array(32)),
		nonce = crypto.getRandomValues(new Uint8Array(24)),
		text = composeBox.innerHTML;
		
	if(anonMode.checked){
		var outString = ''											//no Lock included in anonymous mode
	}else{
		var outString = myLock + '//////'
	}

	var outArray = new Uint8Array(2);	
	if(onceMode.checked){
		outArray[0] = 56												//will become "O" in base64
	}else if(anonMode.checked){
		outArray[0] = 0;												//will become "A" in base64
	}else{
		outArray[0] = 72;												//will become "S" in base64
	}
	outArray[1] = recipients;

	var paddingIn = decoyEncrypt(160);									//for Hidden message

	if(!paddingIn) return;

	var cipher = symEncrypt(text,nonce,msgKey,true);					//main encryption event including compression, but don't add the result yet
		
	if(signedMode.checked || onceMode.checked || isChatInvite){                 //make signature of the ciphertext, length 3309 bytes, to be added later
        if(!refreshKey()) return;
        var signature = noblePostQuantum.ml_dsa65.sign(myDsaKeys.secretKey, cipher)
    }

	outArray = concatUi8([outArray,nonce,paddingIn]);

	//for each email on the List (unless empty), encrypt the message key and add it, prefaced by the first 256 bits of the ciphertext obtained when the item is encrypted with the message nonce and the shared key. Notice: same nonce, but different key for each item (unless someone planted two recipients who have the same key, but then the encrypted result will also be identical).
	for (index = 0; index < encryptArray.length; index++){
		email = encryptArray[index];
		if (email != ''){
			if(email == myEmail){
				var Lock = myLockbin								//binary version
			}else{
				var Lock = decodeBase64(locDir[email][0])
			}
	
			if(anonMode.checked || signedMode.checked || isChatInvite){
				var pubKey = Lock.slice(0,1184);                //1184 bytes for ML-KEM768 public key
				var secret = noblePostQuantum.ml_kem768.encapsulate(pubKey);    //object with sharedSecret and its cipherText, the sharedSecret is 32 bytes, cipherText is 1088 bytes
				var nonce2 = crypto.getRandomValues(new Uint8Array(24));        //new nonce for encrypting the message key, per recipient, 24 bytes
				var cipher2 = nobleCiphers.xchacha20poly1305(secret.sharedSecret, nonce2).encrypt(msgKey);   //48 bytes

				outArray = concatUi8([outArray,secret.cipherText,nonce2,cipher2]) //add 1088 bytes of KEM-encrypted shared secret, plus 24 bytes of nonce, plus 48 bytes encrypted message key, for each recipient, no idTags

			}else{         //Read-once mode
				if(email != myEmail){								//can't do Read-once to myself
					var lastSeedCipher = locDir[email][1],
						lastLockCipher = locDir[email][2],				//retrieve dummy KEM Lock from storage, [0] is the permanent Lock by that email
						turnstring = locDir[email][3],
						nonce2 = crypto.getRandomValues(new Uint8Array(24)),
						nonce3 = crypto.getRandomValues(new Uint8Array(24))		//different nonces for each symmetric encryption

					if(turnstring == 'reset' || !turnstring){       //so that an initial message is seen the same as a reset mesage
						var typeByte = [172],								//becomes 'r' in base64, reset message
							resetMessage = true
					}else if(turnstring == 'unlock'){
						var typeByte = [164]								//becomes 'p' in base64, out of order message
					}else{
						var typeByte = [160]								//becomes 'o' in base64, regular message
					}

					if(lastSeedCipher && turnstring == 'unlock'){           //decrypt previous seed for out of order encryption
						var newSeed = keyDecrypt(lastSeedCipher,true)		//actually, previous seed. keep as a byte array
					}else{
						var newSeed = crypto.getRandomValues(new Uint8Array(64))       //to be stored so both keys can be re-generated
					}													
					
					var newPair = noblePostQuantum.ml_kem768.keygen(newSeed);

					if(lastLockCipher){										//if stored public Key exists, decrypt it first
						var lastLock = keyDecrypt(lastLockCipher,true);
						if(!lastLock) return
					}else{													//use permanent Lock if previous doesn't exist
						var lastLock = Lock.slice(0,1184)               //may be made from a shared Key
					}

					var secret = noblePostQuantum.ml_kem768.encapsulate(lastLock);      //object containing KEM secret and its cipher

					var cipher2 = nobleCiphers.xchacha20poly1305(secret.sharedSecret,nonce2).encrypt(msgKey);       //encrypt message key with KEM secret

					var newLockCipher = nobleCiphers.xchacha20poly1305(secret.sharedSecret,nonce3).encrypt(newPair.publicKey)

					if(turnstring != 'unlock' || !lastSeedCipher){    //for normal and reset scenarios, new seed replaces old    
						locDir[email][1] = keyEncrypt(newSeed)						//new Seed in base64 is stored in the permanent database, unless repeat or empty
					}

					if(email != 'myEmail') outArray = concatUi8([outArray,secret.cipherText,nonce3,newLockCipher,nonce2,cipher2,typeByte]);  //add 1088 bytes of KEM-encrypted shared secret, plus 24 bytes of nonce, plus 2312 bytes of sym-encrypted ephemeral public key, plus anpther 24 of nonce, plus 48 of encrypted message key, plus one of Type, for a total of 2385 bytes, for each recipient

					locDir[email][3] = 'unlock'                  //set to decrypt next
				}
			}
		}
	}
	//all recipients done at this point

	//finish off by adding the encrypted message and tags
	if(anonMode.checked){
		outString += encodeBase64(concatUi8([outArray,cipher])).replace(/=+$/,'')
	}else{                  //signed and read-once modes include a signature of the main ciphertext, as well as chat invites
		outString += encodeBase64(concatUi8([outArray,signature,cipher])).replace(/=+$/,'')
	}
	finishEncrypt(outString,isFileOut,isImageOut,inviteArray,encryptArray.length)			//see if invitations would have been needed
}

//output formatting, which is shared by symmetric encryption modes
function finishEncrypt(outString,isFileOut,isImageOut,inviteArray,recipientNumber){
	var outNode = document.createElement('div');	
	outNode.style.whiteSpace = "pre-line";									//so that carriage returns are respected
	outNode.id = "composeOut";
	var invitesNeeded = !symMode.checked && (inviteArray.length != 0);
	
if(!isImageOut){																//normal output, not to image
	if(stegoMode.checked){
		outString = textStego(outString)
	}else if(invisibleMode.checked){
		outString = invisibleStego(outString)
	}

	if(isFileOut && !invisibleMode.checked){									//output to File
		var fileLink = document.createElement('a');
		if(stegoMode.checked){
			fileLink.download = "ChangeMe.txt";
			fileLink.href = "data:," + outString;
			fileLink.textContent = "KyberLock Hidden message. Make sure to change the name"			
		}else if(onceMode.checked){
			fileLink.download = "KL10mso.kyb";
			fileLink.href = "data:binary/octet-stream;base64," + outString;
			fileLink.textContent = "KyberLock 1.0 Read-once message (binary file)"
		}else if(symMode.checked){
			fileLink.download = "KL10msp.kyb";
			fileLink.href = "data:binary/octet-stream;base64," + outString;
			fileLink.textContent = "KyberLock 1.0 shared Password message (binary file)"
		}else if(anonMode.checked){
			fileLink.download = "KL10msa.kyb";
			fileLink.href = "data:binary/octet-stream;base64," + outString;
			fileLink.textContent = "KyberLock 1.0 Anonymous message (binary file)"
		}else{
			fileLink.download = "KL10mss.kyb";
			fileLink.href = "data:binary/octet-stream;base64," + outString;
			fileLink.textContent = "KyberLock 1.0 Signed message (binary file)"
		}
	}else{																		//output to email page
		if(stegoMode.checked){
			outNode.textContent = outString
		}else if(invisibleMode.checked){
			outNode.textContent = 'Invisible message at the end of the introduction below this line. Edit as needed and remove this notice:\r\n\r\nDear friend,' + outString + '\r\n\r\nBody of the message.'
		}else{
			var fileLink = document.createElement('pre');
			if(onceMode.checked){			
				fileLink.textContent = '----------begin Read-once message encrypted with KyberLock--------==\r\n\r\n' + outString.match(/.{1,80}/g).join("\r\n") + '\r\n\r\n==---------end Read-once message encrypted with KyberLock-----------'
			}else if(isChatInvite){
				fileLink.textContent = '----------begin Chat invitation encrypted with KyberLock--------==\r\n\r\n' + outString.match(/.{1,80}/g).join("\r\n") + '\r\n\r\n==---------end Chat invitation encrypted with KyberLock-----------'
			}else if(symMode.checked){			
				fileLink.textContent = '----------begin shared Password message encrypted with KyberLock--------==\r\n\r\n' + outString.match(/.{1,80}/g).join("\r\n") + '\r\n\r\n==---------end shared Password message encrypted with KyberLock-----------'
			}else if(anonMode.checked){
				fileLink.textContent = '----------begin Anonymous message encrypted with KyberLock--------==\r\n\r\n' + outString.match(/.{1,80}/g).join("\r\n") + '\r\n\r\n==---------end Anonymous message encrypted with KyberLock-----------'
			}else{
				fileLink.textContent = '----------begin Signed message encrypted with KyberLock--------==\r\n\r\n' + outString.match(/.{1,80}/g).join("\r\n") + '\r\n\r\n==---------end Signed message encrypted with KyberLock-----------'
			}
		}
	}
	if(fileLink) outNode.appendChild(fileLink)
}else{																			//no extra text if output is to image
	outNode.textContent = outString
}
	outNode.contentEditable = 'true';
	syncLocDir();
	visibleMode.checked = true;
	decoyMode.checked = false;
	if(isFileOut){
		composeMsg.textContent = "Contents encrypted into a file. Now save it, close this dialog, and attach the file to your email";
		composeBox.textContent = '';
		composeBox.appendChild(outNode);
		openScreen('composeScr')

	}else if(isImageOut){
		composeBox.textContent = '';
		composeBox.appendChild(outNode);
		openScreen('stegoImageScr');
		encodePNGBtn.style.display = '';
		encodeJPGBtn.style.display = '';
		decodeImgBtn.style.display = 'none';
		if((onceMode.checked && recipientNumber == 1) || (!onceMode.checked && recipientNumber < 3)){
			stegoImageMsg.textContent = 'Message encrypted. Now choose an image to hide it into and click either Encrypt to PNG, or Encrypt to JPG. This pre-filled image Password will also be pre-filled on the receiving end.'
		}else{
			stegoImageMsg.textContent = 'Message encrypted. Now choose an image to hide it into and click either Encrypt to PNG, or Encrypt to JPG. For best results, use a Password known to the recipient.'
		}
	}else{
		insertInBody(outNode)
	}
	callKey = '';
	if(invitesNeeded){
		composeMsg.textContent = 'These recipients will not be able to decrypt your message because they are not yet in your directory:\n' + inviteArray.join(', ') + '\nYou should send them an invitation first. You may close this dialog now';
		composeBox.textContent = '';
		openScreen('composeScr')
	}else if(!isFileOut && !isImageOut){
		 	setTimeout(function(){window.close()},200)		//close after a delay, to make sure the command arrives
	}
}

//just to shuffle the array containing the recipients' emails
function shuffle(a) {
    var j, x, i;
    for (i = a.length; i; i -= 1) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x
    }
	return a
}

//encrypts a string or uint8 array with the secret Key, 24 byte nonce, padding so length for ASCII input is the same no matter what. The input can also be binary, and then it won't be padded
function keyEncrypt(plainstr){
    if(!refreshKey()) return undefined;																		//make sure the Key is still alive
    var nonce = crypto.getRandomValues(new Uint8Array(24));
    if(typeof plainstr == 'string'){
        plainstr = encodeURI(plainstr).replace(/%20/g,' ');
        while (plainstr.length < 43) plainstr = plainstr + ' ';
        var cipher = symEncrypt(plainstr,nonce,KeyDir,false)
    }else{
        var cipher = nobleCiphers.xchacha20poly1305(KeyDir, nonce).encrypt(plainstr)
    }
    return encodeBase64(concatUi8([[144],nonce,cipher])).replace(/=+$/,'')		//1st character should be k
}

//decrypts a string encrypted with the secret Key, 24 byte nonce. Returns original if not encrypted. If isArray set, return uint8 array
function keyDecrypt(cipherStr,isArray){
    var cipher = decodeBase64(cipherStr.replace(/[^a-zA-Z0-9+\/]+/g,''));
    if(!cipher) return false;
    if (cipher[0] == 144){
        if(!refreshKey()) return undefined;											//make sure the Key is still alive
        var	nonce = cipher.slice(1,25),	
            cipher2 = cipher.slice(25);
        if(isArray){
            try{
                var plain = nobleCiphers.xchacha20poly1305(KeyDir, nonce).decrypt(cipher2);
                return plain
            }
            catch{
				if(oldPwdStr){
					var oldKeyDir = wiseHash(oldPwdStr,myEmail,32);                         //Uint8Array, length 64
					try{
						var plain = nobleCiphers.xchacha20poly1305(oldKeyDir, nonce).decrypt(cipher2)
					}catch{
						failedDecrypt('old'); return false
					}
				}else{
					failedDecrypt('new'); return false							//this will open the old Password dialog
				}
            }
        }else{
            var plain = symDecrypt(cipher2,nonce,KeyDir,false,'key');
            if(!plain) return;
            return decodeURI(plain.trim())
        }
    }else{
        return cipherStr
    }
}

//this strips initial and final header, plus spaces and non-base64 characters in the middle
function stripHeaders(string,leaveSpaces){
	string = string.replace(/\n/g,'').replace(/&nbsp;/g,'');								//remove special spaces, newlines
	if(string.match('==')) string = string.split('==')[1];								//keep only KyberLock item, if bracketed
	string = string.replace(/<(.*?)>/gi,"").replace(/[^a-zA-Z0-9\+\/\s]/g,''); 		//takes out html tags and anything that is not base64 or a space
	return leaveSpaces ? string : string.replace(/\s/g,'')								//unless leaveSpaces is on, remove spaces as well
}

//to make sure attached Lock is correct
function isBase36(string){
	var result = true;
	for(var i = 0; i < string.length; i++){
		result = result && (base36.indexOf(string.charAt(i)) >= 0)
	}
	return result
}

var padding = '';				//global variable involved in decoding secret message, needed for decoy decrypt
var firstRetrieve = true;		//so retrieveAllSync doesn't get called endlessly

//decrypts a message encrypted for multiple recipients. Encryption can be Anonymous, Signed, Read-once, or an Invitation. This is detected automatically. It can also be an encrypted database
function decryptList(){
	readBox.textContent = '';
	var hasTags = !!text2decrypt.match('=='),
		text = stripHeaders(text2decrypt),										//get the data from a global variable holding it
		hasLock,onlyLock;

	if(isBase64(text.slice(0,4182)) && (text.slice(4182,4188) == '//////')){			//find Lock located at the start
		theirLock = text.slice(0,4182);
		hasLock = true;
		onlyLock = false
		
	}else if(text.length == 4182){													//just a regular Lock
		theirLock = text;
		hasLock = true;
		onlyLock = true
		
	}else if(text.charAt(0) == 'k'){													//it's an encrypted database, so decrypt it and merge it
		var agree = confirm('This is an encrypted local database. It will be loaded if you click OK, possibly replacing current data. This cannot be undone.');
		if(!agree){
			readBox.textContent = '';
			readMsg.textContent = 'Backup merge canceled';
			openReadScreen();
			return
		}
		var newData = JSON.parse(keyDecrypt(text,false));
		locDir = mergeObjects(locDir,newData);
		syncLocDir();
		readMsg.textContent = 'Data from backup merged';
		openReadScreen();
		return
		
	}else{
		hasLock = false
	}
	
	if(hasLock){
		if(Object.entries(locDir).length == 0 && firstRetrieve){			//locDir is empty, try reloading it first, and repeat
			firstRetrieve = false;
			retrieveAllSync();
			return
		}else{
			if(!locDir['myself']) setTimeout(decryptList,0);				//delay and repeat if data has not yet been loaded
			for(var name in locDir){											//find sender by name
				if(locDir[name] && locDir[name][0] == theirLock){
					theirEmail = name;	
					senderBox.textContent = theirEmail
				}
			}
			if(!theirEmail){
				fillList2();
				nameMsg.textContent += '\r\nIts Lock fingerprint is:  ' + lockPrint(decodeBase64(theirLock));
				openScreen('nameScr');
				return
			}else{
				if(!locDir[theirEmail]) locDir[theirEmail] = [];
				locDir[theirEmail][0] = theirLock;
				storeData(theirEmail)
			}
			text = text.slice(4188);												//take out Lock and separator
		}
	}else{
		senderBox.textContent = "Who knows?"
	}
	
	if(!text || onlyLock){
		if(hasLock){
			readMsg.textContent = "This message contains only the sender's Lock. Nothing to decrypt"
		}else{
			readMsg.textContent = "Nothing to decrypt"
		}
		openReadScreen();
		return
	}
	
	var	type = text.charAt(0);
	if(!text.match(/[^A-Z]/)) type = 'h';		//only letters: human mode
	
	if(!hasLock && type != 'A'){							//no Lock, so probably symmetric
		if(type == 'g' || type == 'd' ||type == 'h' || hasTags){
			symmetricDecrypt(text)
		}else{												//no tags so likely just text
			readMsg.textContent = "This message is not encrypted, but perhaps the images or attachments are. Download them and click the arrow to decrypt them";
			openReadScreen()
		}
		return
	}
	
	if(!refreshKey()) return;											//make sure the key is loaded, otherwise stop to get it

	var cipherInput = decodeBase64(text);
	if(!cipherInput) return false;
	firstRetrieve = true;											//safe to reset this
	var	recipients = cipherInput[1];										//number of recipients. '0' reserved for special cases

	if(type == 'g'){
		var nonce = cipherInput.slice(1,25),						//for invitations, no padding
			cipher = cipherInput.slice(25);
		padding = []												//this is global
	}else if(type == 'A' || type == 'S' || type == 'O'){
		var nonce = cipherInput.slice(2,26);									//24 bytes
		padding = cipherInput.slice(26,226);								//200 bytes, global
		cipherInput = cipherInput.slice(226)
	}else{
		readMsg.textContent = "This message is not encrypted, but perhaps the images or attachments are. Download them and click the arrow to decrypt them";
		openReadScreen();
		return
	}

	if(type == 'g'){														//key for Invitation is the first 32 bytes of the sender's Lock, otherwise, got to find it
		var msgKey = decodeBase64(theirLock).slice(0,32);
		if(!msgKey){ return false }else{ var success = true }

	}else{
		//now cut the rest of the input into pieces. First the individual encrypted keys etc., then the ciphertext
		var cipherArray = new Array(recipients);
		if(type != 'O'){													//shorter pieces in Anonymous and Signed modes
			for(var i = 0; i < recipients; i++){
				cipherArray[i] = cipherInput.slice(1160*i,1160*(i+1))		//1088 bytes for encripted KEM key, 24 for nonce, 48 for encrypted message key
			}
			var cipher = cipherInput.slice(1160*recipients)                 //optional signature + encrypted message
		}else{																//longer pieces in Read-once mode
			for(var i = 0; i < recipients; i++){
				cipherArray[i] = cipherInput.slice(2385*i,2385*(i+1))		//1088 for encrypted KEM key, 24 for nonce, 1200 for encrypted ephemeral public key, 24 for nonce, 48 for encrypted message key, 1 for type byte
			}
			var cipher = cipherInput.slice(2385*recipients)
		}

		if (type == 'O' && (theirEmail == myEmail || theirEmail == 'myself')){
			readMsg.textContent = 'You cannot decrypt Read-once messages to yourself';
			openReadScreen();
			return
		}

//for Signed and Read-once modes, verify the signature before anything else
		if((type.match(/[SO]/)) && theirLock.length == 4182){           //don't verify signature in shared Key case
			var signature = cipher.slice(0, 3309);
			var pubDsa = decodeBase64(theirLock).slice(1184);              //second part of the sender's Lock
			var isValid = noblePostQuantum.ml_dsa65.verify(pubDsa, cipher.slice(3309), signature)
			if(!isValid){
				readMsg.textContent = 'This message was not encrypted by ' + name;
				return false
			}
		}

//Now we try decrypting each recipient until one works. Extracting the KEM shared secret will succeed in many cases, but a wrong result will fail when decrypting the encrypted message key. Put a try-catch around that instruction
		var success = false;
		for(var i = 0; i < recipients; i++){

			if(type == 'A' || type == 'S'){					//anonymous and signed modes

				var cipherKEMkey = cipherArray[i].slice(0,1088),
					nonce2 = cipherArray[i].slice(1088,1112),
					cipherMsgKey = cipherArray[i].slice(1112);

				try{                //this will throw an error if the key is wrong   
					var KEMkey = noblePostQuantum.ml_kem768.decapsulate(cipherKEMkey,myKemKeys.secretKey)
					var msgKey = nobleCiphers.xchacha20poly1305(KEMkey,nonce2).decrypt(cipherMsgKey);
					success = true;
					break                           //done, so stop looking
				}catch{
					continue                        //go to the next value of i if it did not work
				}

		//for Read-once mode, first we separate the different parts: KEM-enciphered key (1088 bytes), nonce for public key (24), symmetric-encrypted public key (1200), nonce for messsage key (24), symmetric-encrypted message key (48), type indicator (1)

			}else{                  //Read-once mode

				var cipherKEMkey = cipherArray[i].slice(0,1088),
					nonce3 = cipherArray[i].slice(1088,1112),           //for encrypted KEM public key
					cipherPub = cipherArray[i].slice(1112,2312),
					nonce2 = cipherArray[i].slice(2312,2336),           //for encrypted message key
					cipherMsgKey = cipherArray[i].slice(2336,2384),
					typeByte = cipherArray[i].slice(2384);              //array with single byte

				if(typeByte[0] == 172){													//reset directed by the message itself
					var agree = confirm('If you click OK, the current Read-once conversation with the sender will be reset. This may be OK if this is a new message, but if it is an old one the conversation will go out of sync');
					if(!agree) return;

					locDir[theirEmail][1] = locDir[theirEmail][2] = null							//if reset type, delete ephemeral data first
				}

				var seedCipher = locDir[theirEmail][1];                   //this will be null after reset and when starting

				try{
					if(seedCipher != null){                             //there is a stored seed, from previously sent message
						var lastSeed = keyDecrypt(seedCipher,true);
						var lastPair = noblePostQuantum.ml_kem768.keygen(lastSeed);
						var KEMkey = noblePostQuantum.ml_kem768.decapsulate(cipherKEMkey,lastPair.secretKey)    //32 bytes

					}else{                                              //no stored seed: use permanent keys or that made from shared Key
						var KEMkey = noblePostQuantum.ml_kem768.decapsulate(cipherKEMkey,myKemKeys.secretKey)
					}
					var msgKey = nobleCiphers.xchacha20poly1305(KEMkey,nonce2).decrypt(cipherMsgKey);   //will fail if wrong KEM key
					var newLock = nobleCiphers.xchacha20poly1305(KEMkey,nonce3).decrypt(cipherPub);  //public key included in message
					success = true;
					locDir[theirEmail][2] = keyEncrypt(newLock);						//store the new public Key as base64 (final storage at end)
					locDir[theirEmail][3] = 'lock';                       //ready to respond
					break
				}catch{
					failedDecrypt('read-once');
					continue
				}
			}
		}
	}				//after all this, hopefully the message key has been decrypted

//final decryption for the main message, plus decompression; remove signature in Signed and Read-once modes	
	if(success){
	   var plainstr = symDecrypt((type == 'A' || type == 'g') ? cipher : cipher.slice(3309),nonce,msgKey,true);    //ignore signature
	   plainstr = decryptSanitizer(plainstr);										//non-whitelisted tags and attributes disabled

	   if(type == 'g'){														//add further instructions if it was an invitation
			plainstr = "Congratulations! You have decrypted your first message from me with <b>KyberLock Universal</b>. This is my message to you:<blockquote><em>" + plainstr + "</em></blockquote><br>Do this to reply to me with an encrypted message:<ol><li>Click the <b>Compose</b> or <b>Reply</b> button on your email program, but <em>do not write your message yet</em>. Then click the <b>KyberLock</b> logo (green key near the top of the browser).</li><li>A new window will appear, and there you can write your reply securely.</li><li>After writing your message (and optionally selecting the encryption mode), click the <b>Encrypt to email</b> button.</li><li>The encrypted message will appear in the compose window. Add the recipients, subject, and whatever extra plain text you want, and click <b>Send</b>.</li></ol>";		
		}
		readBox.innerHTML = plainstr;

		syncLocDir();	
		
		if(typeByte){
			if(typeByte[0] == 172){
				readMsg.textContent = 'You have just decrypted the first message or one that resets a Read-once conversation. This message can be decrypted again, but doing so after more messages are exchanged will cause the conversation to go out of sync. It is best to delete it to prevent this possibility'
			}else{
				setTimeout(function(){          //put on parallel branch so plaintext displays before confirm
			//offer to delete local copy of seed to prevent further decryption
					var agree = confirm('Decryption successful. If you click OK, this and all Read-once messages received from this sender since your last reply will become un-decryptable.\nIf you click Cancel, they will remain decryptable until you send a new Read-once message to this sender');
					if(agree){
						locDir[theirEmail][1] = null;
						storeData(theirEmail);
						chrome.storage.session.set({"locDir": JSON.stringify(locDir)});
						readMsg.textContent = 'This message cannot be decrypted again'
					}else{
						readMsg.textContent = 'This message can be decrypted until you reply to the sender in Read-once mode'
					}
				},0) 
			}
		}else{
			if(type == 'A'){
				readMsg.textContent = 'Anonymous decryption successful'
			}else{
				readMsg.textContent = 'Decryption successful'
			}
		}
   }else{
		readMsg.textContent = 'Decryption has failed';
		if(type == 'A'){failedDecrypt('anon')}else if(type == 'S'){failedDecrypt('signed')}
   }

	openReadScreen();
	callKey = ''
}

//displays how many characters are left in decoy message
function charsLeftDecoy(){
	var chars = encodeURI(decoyText.value).replace(/%20/g, ' ').length;
	var limit = 160;
	if (chars <= limit){
		decoyMsg.textContent = chars + " characters out of " + limit + " used"
	}else{
		decoyMsg.textContent = 'Maximum length exceeded. The message will be truncated'
	}
}

//encrypts a hidden message into the padding included with list encryption, or makes a random padding also encrypted so it's indistinguishable
function decoyEncrypt(length){
	if(decoyMode.checked){
		if (!decoyInBox.value.trim() || !decoyText.value.trim()){ 					//stop to display the decoy entry form if there is no hidden message or key
			openScreen('decoyInScr');
			return false
		}
		var decoyKeyStr = decoyInBox.value.trim(),
			text = encodeURI(decoyText.value.trim().replace(/%20/g, ' ')),
			nonce = crypto.getRandomValues(new Uint8Array(24));

		var sharedKey = wiseHash(decoyKeyStr,encodeBase64(nonce),32);			//symmetric encryption for true shared key
		
		while (text.length < length) text = text + ' ';				//add spaces to make the number of characters required
		text = text.slice(0,length);
		var cipher = concatUi8([nonce,symEncrypt(text,nonce,sharedKey,false)]);
		
		decoyInBox.value = '';
		decoyText.value = '';
		openReadScreen()

	}else{
		var cipher = crypto.getRandomValues(new Uint8Array(length + 40))        //no decoy mode so padding is random;
	}
	return cipher
}

//decrypt the message hidden in the padding, for decoy mode
function decoyDecrypt(cipher){
	var decoyKeyStr = decoyOutBox.value.trim();		//turn into local variable
	decoyOutBox.value = '';

	var nonce = cipher.slice(0,24),
		cipherMsg = cipher.slice(24),
		sharedKey = wiseHash(decoyKeyStr,encodeBase64(nonce),32);

	var plain = symDecrypt(cipherMsg,nonce,sharedKey,false);     //it has its own error catching
	
	if(plain){
		return 'Hidden message: ' + decodeURI(plain)
	}else{
		return "No Hidden message found"
	}
}

//does decoy decryption after a button is clicked
function doDecoyDecrypt(){
	if(padding){
		if(!decoyOutBox.value.trim()){					//stop to display the decoy key entry form if there is no key entered
			openScreen('decoyOutScr');
			return
		}
		openScreen('readScr');
		var decoyMsg = decoyDecrypt(padding);
		if(decoyMsg){
			readMsg.textContent = decoyMsg
		}else{
			readMsg.textContent = 'No Hidden message found'
		}
		padding = ''
	}else{
		readMsg.textContent = 'You must have just decrypted an eligible message in order to use this feature'
	}
}
