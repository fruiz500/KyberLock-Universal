﻿//a bunch of global variables. The rest of the global variables are flags that are defined right before they are to be used.
//mySeed is a 64-byte uint8 array private key deriving from the user's secret Key, for KEM and local encryption. myEmail is what it sounds like (string). myLockbin is the derived public Key. Suffix "bin" means it is binary.
//theirEmail, etc, refers to the sender or recipient at the moment a certain encryption or decryption is taking place. Global variable needed for error handling.
//locDir is an object containing the data that is saved between sessions
var	KeyStr,
	KeyDir,
	mySeed,
	oldPwdStr,
	myEmail,
	myLockbin,
	myLock,
	myKemKeys,
	myDsaKeys,
	theirEmail,
	theirLock,
	theirLockbin,
	emailList,
	activeTab,
	soleRecipient,
	callKey = '',
	locDir = {},
	emailSvc,
	emailList = [];

//resets the Keys in memory when the timer ticks off
function resetKeys(){
	KeyStr = '';
	KeyDir = '';
	mySeed = '';
	myKemKeys = '';
	myDsaKeys = '';
	myLockbin = '';
	myLock = '';
	pwdMsg.textContent = 'Your secret Key has expired. Please enter it again';
	pwdMsg.style.color = '';
	chrome.runtime.sendMessage({message: 'delete_keys'})		//also reset in background page
}

//reads Key and stops if there's something wrong. If the timer has run out, the Key is deleted from box, and stretched keys are deleted from memory
function refreshKey(){
	resetTimer();
	if (!mySeed){					//if keys are gone, prompt for user password
		openScreen('pwdScr');
		return false
	}else{return true}
}

var keyTimer = 0;

//this function erases the secret values after 5 minutes
function resetTimer(){
	var period = 300000;
	clearTimeout(keyTimer);	
	keyTimer = setTimeout(function() {		//start timer to reset Password box
		resetKeys()
	}, period);

	chrome.runtime.sendMessage({message: 'reset_timer'})		//also start clock in background page
}

//function to test key strength and come up with appropriate key stretching. Based on WiseHash
function keyStrength(string,loc) {
	var entropy = entropycalc(string),
		msg,colorName;

	if(entropy == 0){
		msg = 'This is a known bad Password!';
		colorName = 'magenta'
	}else if(entropy < 20){
		msg = 'Terrible!';
		colorName = 'magenta'
	}else if(entropy < 40){
		msg = 'Weak!';
		colorName = 'red'
	}else if(entropy < 60){
		msg = 'Medium';
		colorName = 'darkorange'
	}else if(entropy < 90){
		msg = 'Good!';
		colorName = 'green'
	}else if(entropy < 120){
		msg = 'Great!';
		colorName = 'blue'
	}else{
		msg = 'Overkill  !!';
		colorName = 'cyan'
	}

	var iter = Math.max(1,Math.min(20,Math.ceil(24 - entropy/5)));			//set the scrypt iteration exponent based on entropy: 1 for entropy >= 120, 20(max) for entropy <= 20

	var seconds = time10/10000*Math.pow(2,iter-8);			//to tell the user how long it will take, in seconds
	var msg = 'Key strength: ' + msg + '\r\nUp to ' + Math.max(0.01,seconds.toPrecision(3)) + ' sec. to process';
	if(loc && string){
		var msgName = loc.replace(/[0-9]/,'') + 'Msg';			//remove numbers because synth screen messages are not numbered
		document.getElementById(msgName).textContent = msg;
		hashili(msgName,string);
		document.getElementById(msgName).style.color = colorName
	}
	return iter
};

//takes a string and calculates its entropy in bits, taking into account the kinds of characters used and parts that may be in the general wordlist (reduced credit) or the blacklist (no credit)
function entropycalc(string){

//find the raw Keyspace
	var numberRegex = new RegExp("^(?=.*[0-9]).*$", "g");
	var smallRegex = new RegExp("^(?=.*[a-z]).*$", "g");
	var capRegex = new RegExp("^(?=.*[A-Z]).*$", "g");
	var base64Regex = new RegExp("^(?=.*[/+]).*$", "g");
	var otherRegex = new RegExp("^(?=.*[^a-zA-Z0-9/+]).*$", "g");

	string = string.replace(/\s/g,'');										//no credit for spaces

	var Ncount = 0;
	if(numberRegex.test(string)){
		Ncount = Ncount + 10;
	}
	if(smallRegex.test(string)){
		Ncount = Ncount + 26;
	}
	if(capRegex.test(string)){
		Ncount = Ncount + 26;
	}
	if(base64Regex.test(string)){
		Ncount = Ncount + 2;
	}
	if(otherRegex.test(string)){
		Ncount = Ncount + 31;											//assume only printable characters
	}

//start by finding words that might be on the blacklist (no credit)
	string = reduceVariants(string);
	var wordsFound = string.match(blackListExp);							//array containing words found on the blacklist
	if(wordsFound){
		for(var i = 0; i < wordsFound.length;i++){
			string = string.replace(wordsFound[i],'');						//remove them from the string
		}
	}

//now look for regular words on the wordlist
	wordsFound = string.match(wordListExp);									//array containing words found on the regular wordlist
	if(wordsFound){
		wordsFound = wordsFound.filter(function(elem, pos, self) {return self.indexOf(elem) == pos;});	//remove duplicates from the list
		var foundLength = wordsFound.length;							//to give credit for words found we need to count how many
		for(var i = 0; i < wordsFound.length;i++){
			string = string.replace(new RegExp(wordsFound[i], "g"),'');									//remove all instances
		}
	}else{
		var foundLength = 0;
	}

	string = string.replace(/(.+?)\1+/g,'$1');								//no credit for repeated consecutive character groups

	if(string != ''){
		return (string.length*Math.log(Ncount) + foundLength*Math.log(wordLength + blackLength))/Math.LN2
	}else{
		return (foundLength*Math.log(wordLength + blackLength))/Math.LN2
	}
}

//take into account common substitutions, ignore spaces and case
function reduceVariants(string){
	return string.toLowerCase().replace(/[óòöôõo]/g,'0').replace(/[!íìïîi]/g,'1').replace(/[z]/g,'2').replace(/[éèëêe]/g,'3').replace(/[@áàäâãa]/g,'4').replace(/[$s]/g,'5').replace(/[t]/g,'7').replace(/[b]/g,'8').replace(/[g]/g,'9').replace(/[úùüû]/g,'u');
}

//makes 'pronounceable' hash of a string, so user can be sure the password was entered correctly
var vowel = 'aeiou',
	consonant = 'bcdfghjklmnprstvwxyz',
	hashiliTimer;
function hashili(msgID,string){
	var element = document.getElementById(msgID);
	clearTimeout(hashiliTimer);
	hashiliTimer = setTimeout(function(){
		if(!string.trim()){
			element.innerText += ''
		}else{
			var code = nobleHashes.sha512(decodeUTF8(string.trim())).slice(-2),      //take last 2 bytes of the sha512, for compatibility with PassLok		
				code10 = ((code[0]*256)+code[1]) % 10000,		//convert to decimal
				output = '';

			for(var i = 0; i < 2; i++){
				var remainder = code10 % 100;								//there are 5 vowels and 20 consonants; encode every 2 digits into a pair
				output += consonant[Math.floor(remainder / 5)] + vowel[remainder % 5];
				code10 = (code10 - remainder) / 100
			}
			element.innerText += '\n' + output
		}
	}, 1000);						//one second delay to display hashili
}

//does the pending action set in variable callKey
function doAction(){
	if(callKey == 'encrypt'){					//now complete whatever was being done when the key was found missing
		encrypt()
	}else if(callKey == 'encrypt2file'){
		encrypt2file()
	}else if(callKey == 'encrypt2image'){
		encrypt2image()
	}else if(callKey == 'inviteEncrypt'){
		inviteEncrypt()
	}else if(callKey == 'decrypt'){
		decrypt()
	}else if(callKey == 'decryptItem'){
		decryptItem()
	}else if(callKey == 'movedb'){
		openScreen('composeScr');
		moveDB()
	}else if(callKey == 'compose'){
		updateComposeButtons();
		openScreen('composeScr')
	}else if(callKey == 'showLock'){
		openScreen('readScr');
		showLock()
	}else{
		callKey = 'compose';
		updateComposeButtons();
		openScreen('composeScr')
	}
}

//converts user Password into binary format and checks that it hasn't changed, resumes operation after keys are loaded
function acceptpwd(){
	var email = myEmailBox.value.trim(),
		key = pwdBox.value.trim();
	if(key == ''){
		pwdMsg.textContent = 'Please enter your secret Key';
		return
	}
	if(key.length < 4){
		pwdMsg.textContent = 'This Key is too short';
		return
	}
	KeyStr = key;
	myEmail = email;
	pwdMsg.textContent = '';
	pwdMsg.style.color = '';
	var blinker = document.createElement('span'),
		msgText = document.createElement('span');
	blinker.className = "blink";
	blinker.textContent = "LOADING...";
	msgText.textContent = " for best speed, use at least a Medium Key";
	pwdMsg.appendChild(blinker);
	pwdMsg.appendChild(msgText);

	if(!mySeed && KeyStr && myEmail){
		mySeed = wiseHash(KeyStr,myEmail,64);                         //Uint8Array, length 64
		KeyDir = wiseHash(KeyStr,myEmail,32);
        myKemKeys = noblePostQuantum.ml_kem768.keygen(mySeed);       //object with two Uint8Array, public length 1184, secret length 2400
        myDsaKeys = noblePostQuantum.ml_dsa65.keygen(mySeed.slice(0,32));        //object with two Uint8Array, public length 1952, secret length 4032
		if(!myLock){                                                //signing public key concatenated with encrypting public key, length 3136
        	myLockbin = concatUi8([myKemKeys.publicKey,myDsaKeys.publicKey]);
        	myLock = encodeBase64(myLockbin).replace(/=+$/,'')          //base64, length 4182
		}
		if(websiteName) prevWebsiteName = websiteName
	}

	if(!checkPwd()){mySeed = ''; return}						//make sure it was not a mistake by comparing Lock with stored Lock
	pwdBox.value = '';											//safe to delete box after check
	if(!locDir['myself']) locDir['myself'] = [];
	locDir['myself'][0] = myLock;
	locDir['myself'][1] = myEmail;
	storeData('myself');								//store in sync storage
	preserveKeys();										//store also in session storage
		
	firstTimeUser = false;
	firstTimeKey.style.display = 'none';
		
	chrome.runtime.sendMessage({message: 'preserve_keys', KeyStr: KeyStr, mySeed: mySeed, myLockbin: myLockbin, myLock: myLock, locDir: locDir});		//send them to background

	doAction()					//do what was being done when the key was found missing
}

function checkEmail(email){
	return /\S+@\S+\.\S+/.test(email)
}

var newPwdAccepted = false;

//make sure the secret Key entered is the same as last time, otherwise stop for confirmation.
function checkPwd(){
	if(!locDir['myself']) return true;
	if(myLock == locDir['myself'][0]) return true;
	if(!newPwdAccepted){											//first time: arm the button and wait for user to click again
		newPwdAccepted = true;
		pwdMsg.textContent = "This is not the same Key as last time. If you click OK again, it will be accepted as your new Key";
		acceptPwdBtn.style.background = '#FB5216';
		acceptPwdBtn.style.color = 'white';
		setTimeout(function() {
			newPwdAccepted = false;
			acceptPwdBtn.style.background = '';
			acceptPwdBtn.style.color = ''
		}, 10000)								//forget request after 10 seconds
		return false
	}else{															//new Password accepted, so store it and move on
		newPwdAccepted = false;
		return true
	}
}

//stretches a password string with a salt string to make a 256-bit Uint8Array Key
function wiseHash(pwd,salt,length){
    var iter = keyStrength(pwd,false),
        output = new Uint8Array(length);
    output = nobleHashes.scrypt(pwd,salt,{ N: 2 ** iter, r: 8, p: 1, dkLen: length });
    return output
}

var time10;			//will be filled at the end of window load

//encrypt string with a symmetric Key, returns a uint8 array
function symEncrypt(plainstr,nonce,symKey,isCompressed){
	if(!isCompressed || plainstr.match('="data:')){						//no compression if it includes a file
		var plain = decodeUTF8(plainstr)
	}else{
		var plain = LZString.compressToUint8Array(plainstr)
	}
	return nobleCiphers.xchacha20poly1305(symKey, nonce).encrypt(plain)
}

//decrypt string (or uint8 array) with a symmetric Key
function symDecrypt(cipherStr,nonce,symKey,isCompressed){
	if(typeof cipherStr == 'string'){
		var cipher = decodeBase64(cipherStr);
		if(!cipher) return false
	}else{
		var cipher = cipherStr
	}

	try{
		var plain = nobleCiphers.xchacha20poly1305(symKey, nonce).decrypt(cipher);                         //it might not decrypt
	}
	catch{
		failedDecrypt('key');
		return false
	}

	if(!isCompressed || plain.join().match(",61,34,100,97,116,97,58,")){		//this is '="data:' after encoding
		return encodeUTF8(plain)
	}else{
		return LZString.decompressFromUint8Array(plain)
	}
}

//this one escapes dangerous characters, preserving non-breaking spaces
function escapeHTML(str){
	escapeHTML.replacements = { "&": "&amp;", '"': "&quot;", "'": "&#039;", "<": "&lt;", ">": "&gt;" };
	str = str.replace(/&nbsp;/gi,'non-breaking-space')
	str = str.replace(/[&"'<>]/g, function (m){
		return escapeHTML.replacements[m];
	});
	return str.replace(/non-breaking-space/g,'&nbsp;')
}

//remove XSS vectors using DOMPurify
function decryptSanitizer(string){
	return DOMPurify.sanitize(string, {ADD_DATA_URI_TAGS: ['a']})
}

//takes appropriate UI action if decryption fails
function failedDecrypt(marker){
	if(marker == 'new'){
		openScreen('oldKeyScr')
	}else if(marker == 'old'){
		if(callKey == 'decrypt'){
			readMsg.textContent = 'The old Key has not worked either. Reload the email page and try again';
			resetSpan.style.display = 'block'
		}else if(callKey == 'compose'){
			composeMsg.textContent = 'The old Key has not worked either. Reload the email page and try again';
			if(composeRecipientsBox.innerHTML.split(', ').length < 2 && onceMode.checked){
				resetSpan2.style.display = 'block';				//display this only if one recipient
				composeMsg.textContent = 'The old Key has not worked either. Try resetting the exchange with this recipient'
			}
		}
	}else if(marker == 'read-once'){
		restoreTempLock();
		readMsg.textContent = 'Read-once messages can be decrypted only once. You may want to reset the exchange with the button below';
		resetSpan.style.display = 'block'
		callKey = ''
	}else if(marker == 'signed'){
		restoreTempLock();
		readMsg.textContent = 'Decryption has Failed. Please check your secret Key';
		callKey = ''
	}else{
		restoreTempLock();
		readMsg.textContent = 'Decryption has Failed';
		callKey = ''		
	}
}

//restores the original Lock if unlocking from a new Lock fails
function restoreTempLock(){
	if(theirEmail && tempLock){
		locDir[theirEmail][0] = tempLock;
		tempLock = '';
		storeData(theirEmail)
	}
}

//Alphabets for base conversion. Used in making and reading the ezLock format
var base36 = '0123456789abcdefghijkLmnopqrstuvwxyz';										//capital L so it won't be mistaken for 1
var base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

//changes the base of a number. inAlpha and outAlpha are strings containing the base code for the original and target bases, as in '0123456789' for decimal
//adapted from http://snippetrepo.com/snippets/bignum-base-conversion, by kybernetikos
function changeBase(numberIn, inAlpha, outAlpha, isLock) {
	var isWordsIn = inAlpha instanceof RegExp || inAlpha.match(' '),				//detect whether it's words into string, or the opposite
		isWordsOut = outAlpha instanceof RegExp || outAlpha.match(' ');			//could be RegExp or space-delimited
		
	//split alphabets into array
	var alphaIn = isWordsIn ? (inAlpha instanceof RegExp ? inAlpha.toString().slice(1,-2).split('|') : inAlpha.trim().split(' ')) : inAlpha.split(''),
		alphaOut = isWordsOut ? (outAlpha instanceof RegExp ? outAlpha.toString().slice(1,-2).split('|') : outAlpha.trim().split(' ')) : outAlpha.split('');
	
	var targetBase = alphaOut.length,
		originalBase = alphaIn.length;
    var result = [],
		number = isWordsIn ? numberIn.trim().replace(/ +/g,' ').split(' ') : numberIn.split('');
		
	if(isWordsIn){										//convert words into dictionary variants
		for(var i = 0; i < number.length; i++){
			number[i] = reduceVariants(number[i])
		}
	}
	
    while (number.length > 0) {
        var remainingToConvert = [], resultDigit = 0;
        for (var position = 0; position < number.length; ++position) {
            var idx = alphaIn.indexOf(number[position]);
            if (idx < 0) {
				readMsg.textContent = "Word '" + replaceVariants(number[position]) + "' in word Lock not found in dictionary. Please check"
				return false
            }
            var currentValue = idx + resultDigit * originalBase;
            var remainDigit = Math.floor(currentValue / targetBase);
            resultDigit = currentValue % targetBase;
            if (remainingToConvert.length || remainDigit) {
                remainingToConvert.push(alphaIn[remainDigit])
            }
        }
        number = remainingToConvert;
        result.push(alphaOut[resultDigit])
    }
	
	if(isLock){													//add leading zeroes in Locks
		var lockLength = isWordsOut ? 20 : ((targetBase == 36) ? 50 : 43);
		while(result.length < lockLength) result.push(alphaOut[0])
	}
	result.reverse();
	
	if(isWordsOut){											//convert to regular words
		for(var i = 0; i < result.length; i++){
			result[i] = replaceVariants(result[i])
		}
	}

    return isWordsOut ? result.join(' ') : result.join('')
}

//displays Lock on the read screen
function showLock(){
	callKey = 'showLock';
	if(!refreshKey()) return;											//make sure the key is loaded, otherwise stop to get it
	
	readBox.textContent = "This is your Lock, which is also at the start of most material encrypted by you:\r\n\r\n";
	var el = document.createElement('pre');
    el.textContent = "----------begin KyberLock 1.0 Lock--------==\r\n\r\n" + myLock.match(/.{1,80}/g).join("\r\n") + "\r\n\r\n==---------end KyberLock 1.0 Lock-----------";
	readBox.appendChild(el);
	readMsg.textContent = "Below is your Lock. Put it in your email signature so people can send you encrypted messages.\r\nIts fingerprint is:  " + lockPrint(myLockbin)
}

//creates fingerprint of a Lock in base36, for display. The lock is a Uint8Array of length 3136
function lockPrint(lock){
    if(lock.length == 3136){
        var print = changeBase(encodeBase64(nobleHashes.cshake256(lock)).replace(/=/g,''),base64,base36,true).match(/.{1,5}/g).join("-");
    }else{
        var print = 'This is not a Lock'
    }
    return print
}
