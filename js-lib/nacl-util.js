// taken from an old version of TweetNaCl, which dropped this code eventually

decodeUTF8 = function(s) {
  var i, d = decodeURIComponent(encodeURIComponent(s)), b = new Uint8Array(d.length);
  for (i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
  return b
};

encodeUTF8 = function(arr) {
  var i, s = [];
  for (i = 0; i < arr.length; i++) s.push(String.fromCharCode(arr[i]));
  return decodeURIComponent(encodeURIComponent(s.join('')))
};

encodeBase64 = function(arr) {
  if (typeof btoa === 'undefined') {
    return (new Buffer(arr)).toString('base64');
  } else {
    var i, s = [], len = arr.length;
    for (i = 0; i < len; i++) s.push(String.fromCharCode(arr[i]));
    return btoa(s.join(''))
  }
};

decodeBase64 = function(s) {
  if (typeof atob === 'undefined') {
    return new Uint8Array(Array.prototype.slice.call(new Buffer(s, 'base64'), 0));
  } else {
	  try{															//added try because atob may fail
      var i, d = atob(s), b = new Uint8Array(d.length)
	  }catch(error){
		  return false
	  }
    for (i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
    return b
  }
};