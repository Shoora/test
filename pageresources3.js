var GR = GR || {};
GR.ignoreProtocols = ['data:', 'chrome:', 'javascript:', 'about:', 'resource:', 'jar:'];
GR.findHtml = function(win, docs) {
    docs = docs || [];
    if ( win ) {
        var frames = win.frames;
		try {
			if ( win.document ) {
				if ( GR.isValidProtocol(win.document.location.href) ) {
					GR.addResource("html", win.document.location.href);
					docs[docs.length] = win.document;
				}
			}
			// recurse into this iframe and find sub-iframes (if any)
			for ( var i = 0, len = frames.length; i < len; i++ ) {
				GR.findHtml(frames[i], docs);
			}
		}
		catch(err) {
			GR.dprint("findHtml: Caught error accessing window document. Error: " + err.description);
		}
    }
    return docs;
};
GR.findScripts = function(doc) {
	var aElems = doc.getElementsByTagName("script");
	for ( var i = 0, len = aElems.length; i < len; i++ ) {
		var elem = aElems[i];
		if ( "string" === typeof(elem["src"]) && elem["src"].length && GR.isValidProtocol(elem["src"]) ) {
			if ( -1 === elem["src"].indexOf("mobileperf/") ) {
				GR.addResource("js", elem["src"]);
			}
		}
	}
};
GR.findStylesheets = function(doc) {
	var aElems = doc.styleSheets;
	for ( var i = 0, len = aElems.length; i < len; i++ ) {
		var elem = aElems[i];
		if ( "string" === typeof(elem["href"]) && elem["href"].length && GR.isValidProtocol(elem["href"]) ) {
			if ( elem["href"] != doc.location ) {
				// In FF *all* the stylesheets have an HREF field. It's set to the document.location.
				GR.addResource("css", elem["href"]);
			}
			// If it IS an imported styled sheet we'll add the component inside this function.
			GR.findImportedStyleSheets(elem);
		}
		// IE
		if ( "object" === typeof(elem["imports"]) ) {
			var aImports = elem["imports"];
			for ( var j = 0, lenImports = aImports.length; j < lenImports; j++ ) {
				var elemImport = aImports[j];
				if ( "string" === typeof(elemImport["href"]) && elemImport["href"].length && GR.isValidProtocol(elemImport["href"]) ) {
					GR.addResource("css", elemImport["href"]);
				}
			}
		}
	}
};
GR.findImportedStyleSheets = function(styleSheet) {
	try {
		if ( "object" === typeof(styleSheet["cssRules"]) ) {
			for (var irule in styleSheet["cssRules"]) {
				if ( "length" === irule ) {
					continue;
				}
				var rule = styleSheet["cssRules"][irule];
				if ( "object" == typeof(rule["styleSheet"]) &&
                     "string" == typeof(rule["styleSheet"]["href"]) && 
					 rule["styleSheet"]["href"].length && 
					 GR.isValidProtocol(rule["styleSheet"]["href"]) ) {
					var impStyleSheet = rule["styleSheet"];
					// It IS an imported stylesheet!
					GR.addResource("css", impStyleSheet["href"]);
					// Recursively check if this stylesheet itself imports any other stylesheets.
					GR.findImportedStyleSheets(impStyleSheet);
				}
				else {
					break;
				}
			}
		}
	}
	catch(err) {
		GR.dprint("findImportedStyleSheets: Caught error finding imported stylesheets. Error: " + err.description);
	}
};
GR.findImages = function(doc) {
	var aElems = doc.images;
	var hFound = {};
	for ( var i = 0, len = aElems.length; i < len; i++ ) {
		var elem = aElems[i];
		if ( "string" === typeof(elem["src"]) && elem["src"].length && GR.isValidProtocol(elem["src"]) ) {
			var src = elem["src"];
			if ( "undefined" === typeof(hFound[src]) ) {
				hFound[src] = 1;
				GR.addResource("image", src, elem);
			}
		}
	}
};
GR.findBgImages = function(doc) {
	var elems = doc.getElementsByTagName('*');
	var nElems = elems.length;
	GR.hBgImages = {};
	for ( var i = 0; i < nElems; i++ ) { 
		var elem = elems[i];
		var imageUrl = GR.getStyleAndUrl(elem, 'backgroundImage', true, doc);
		if ( imageUrl ) {
			if ( 0 == imageUrl.toLowerCase().indexOf("data:") ) {
				continue;
			}
			imageUrl = imageUrl.replace("\\", ""); // Firefox 3.5 added a backslash to a URL that contained a comma (",")
			if ( ! GR.hBgImages[imageUrl] ) {
				GR.hBgImages[imageUrl] = 1;
				GR.addResource("cssimage", imageUrl, elem);
			}
		}
	}
};
GR.findFlash = function(doc) {
    var aElements = doc.applets;
    for ( var i = 0, len = aElements.length; i < len; i++ ) {
		var elem = aElements[i];
		if ( "string" == typeof(elem["Movie"]) && elem["Movie"].length ) {
			GR.addResource("flash", elem["Movie"]);
		}
	}
    var aElements = doc.getElementsByTagName("embed");
	for ( var i = 0, len = aElements.length; i < len; i++) {
		var elem = aElements[i];
        if ( "string" == typeof(elem["src"]) && elem.src.length && GR.isValidProtocol(elem.src) ) {
			GR.addResource("flash", elem.src);
		}
	}
};
GR.isValidProtocol = function(url) {
    url = url.toLowerCase();
    for ( var max = GR.ignoreProtocols.length, i = 0; i < max; i++ ) {
        if ( url.indexOf(GR.ignoreProtocols[i]) === 0 ) {
            return false;
        }
    }
    return true;
};
GR.addResource = function(type, url, elem) {
	var resource = { 'url': url, 'type': type };
	if ( "image" === type ) {
		if ( "undefined" != typeof(elem.naturalWidth) ) {
			resource['width'] = elem.naturalWidth;
			resource['height'] = elem.naturalHeight;
		}
		else {
			resource['width'] = elem.width;
			resource['height'] = elem.height;
		}
		if ( "undefined" != typeof(elem.fileSize) ) {
			resource['fileSize'] = elem.fileSize;
		}
	}
	// TODO - find other data worth saving for scripts, stylesheets, etc.
	if ( "undefined" === typeof(GR.resources[type]) ) {
		GR.resources[type] = [];
	}
	var aResources = GR.resources[type];
	aResources[aResources.length] = resource;
};
GR.dprint = function(msg) {
	if ( "undefined" != typeof(console) && "undefined" != typeof(console.log) ) {
		console.log(msg);
	}
};
GR.init = function() {
	GR.resources = {};
	GR.nResources = 0;
	GR.bIE = ( -1 != navigator.userAgent.indexOf('MSIE') );
};
GR.removeDiv = function() {
	var div = document.getElementById('grdiv');
	div.parentNode.removeChild(div);
};
GR.report = function(doc, bInline) {
	var div = doc.createElement('div');
	div.id = "grdiv";
	div.style.cssText = 
	    ( bInline ?
		  "font-size: 14px; font-family: Arial; line-height: 1.3em;" :
		  "border: 2px solid #000; background: white; padding: 0 0 4px 8px; margin: 8px; position: absolute; top: 50px; left: 50px; font-size: 10px; font-family: Arial; z-index: 9999; color: #000; text-align: left; line-height: 1.3em;" );
	var sHtml = 
	    ( bInline ? 
		  "" : 
		  "<div style='float: right; text-align: right;'><a style='font-weight: bold; color: #FFF; text-decoration: none; border: 1px solid #C00; padding: 0 2px 0 2px; background: #C00;' href='#' onclick='GR.removeDiv(); return false;'>X</a></div>" ) +
	    "<div style='margin-bottom: 8px;'><a style='font-weight: bold; font-size: 1.1em; text-decoration: underline; color: #303; border: 0;' href='http://stevesouders.com/mobileperf/pageresources.php' target='_blank'>Page Resources bookmarklet333</a></div>";
	// List the resources in these categories:
	var aTypes = ["html", "js", "css", "image", "cssimage", "flash"];
	GR.nResources = 0;
	var sResources = "";
	for ( var i = 0, len = aTypes.length; i < len; i++ ) {
		var type = aTypes[i];
		var aResources = GR.resources[type];
		if ( aResources ) {
			GR.nResources += aResources.length;
			sResources += GR.reportType(type);
		}
	}
	div.innerHTML = sHtml +
	    "<div style='margin-bottom: 6px;'><nobr>" + GR.nResources + " resource" + ( 1 === GR.nResources ? "" : "s" ) + 
	    ( bInline ? 
		  "" :
		  "<a style='color: #00E; text-decoration: underline; margin-left: 40px; margin-right: 8px;' href='javascript:GR.saveResults()'>save to Jdrop</a>" ) +
	    "</nobr></div>" +
	    sResources;
	doc.body.appendChild(div);
};
GR.reportType = function(type) {
	var aResources = GR.resources[type];
	if ( ! aResources ) {
		return "";
	}
	var len = aResources.length;
	var id = "pr_" + type;
	var sHtml = "<div style='margin-top: 6px;'>" +
	    "<a style='border: 0; text-decoration: underline; color: #0645AD;' href='#' onclick='GR.toggle(this, \"" + id + "\"); return false;'><img border=0 src='//stevesouders.com/mobileperf/twistyClosed.png'></a> " +
	    len + " " + GR.prettyType(type) + " resource" + ( 1 < len ? "s" : "" ) + 
	    ":</div>" +
	    "<div id='" + id + "' style='display: none; margin-left: 10px;'>";
	for ( var i = 0; i < len; i++ ) {
		var resource = aResources[i];
		sHtml += "<div style='margin-right: 8px;'><a style='border: 0; text-decoration: underline; color: #0645AD;' href='" + resource['url'] + "'>" + GR.shortenUrl(resource['url']) + "</a> " +
			GR.reportTypeDetails(type, resource) +
			"</div>";
	}
	sHtml += "</div>";
	return sHtml;
};
// return a string of additional details
GR.reportTypeDetails = function(type, resource) {
	sHtml = "";
	if ( "image" === type ) {
		if ( "undefined" != typeof(resource.width) ) {
			sHtml += "(" + resource.width + "x" + resource.height;
		}
		if ( "undefined" != typeof(resource.fileSize) ) {
			sHtml += ", " + parseInt(resource.fileSize / 1024) + "K";
		}
		sHtml += ")";
	}
	return sHtml;
};
GR.saveResults = function() {
	SaveToJdrop("Page Resources", GR.resources, "0.1", GR.nResources + " resource" + ( 1 === GR.nResources ? "" : "s" ))
};
GR.toggle = function(a, targetId) {
	var elem = document.getElementById(targetId);
	if ( a && elem ) {
		bShow = ( "none" == elem.style.display );
		elem.style.display = ( bShow ? "block" : "none" );
		a.getElementsByTagName('img')[0].src = ( bShow ? "//stevesouders.com/mobileperf/twistyOpen.png" : "//stevesouders.com/mobileperf/twistyClosed.png" );
	}
};
GR.getStyleAndUrl = function(elem, prop, bGetUrl, doc) {
	var val = "";
	if ( elem.currentStyle ) {
		val = elem.currentStyle[prop];
	}
	if ( elem.ownerDocument && elem.ownerDocument.defaultView && doc.defaultView.getComputedStyle ) {
		var style = elem.ownerDocument.defaultView.getComputedStyle(elem, "");
		if ( style ) {
			val = style[prop];
		}
	}
	if ( "backgroundPosition" === prop && GR.bIE ) {
		var posX = GR.getStyleAndUrl(elem, 'backgroundPositionX', false, doc);
		posX = ( "left" == posX ? "0%" : ( "center" == posX ? "50%" : ( "right" == posX ? "100%" : posX ) ) );
		var posY = GR.getStyleAndUrl(elem, 'backgroundPositionY', false, doc);
		posY = ( "top" == posY ? "0%" : ( "center" == posY ? "50%" : ( "bottom" == posY ? "100%" : posY ) ) );
		val = posX + " " + posY;
	}
	if ( !bGetUrl ) {
		return val;
	}
	if ( "string" != typeof(val) || 0 !== val.indexOf('url(') ) {
		return false;
	}
	val = val.replace(/url\(/, "");
	val = val.substr(0, val.length - 1);
	if ( 0 === val.indexOf('"') ) {
		val = val.substr(1, val.length - 2);
	}
	return val;
};
GR.shortenUrl = function(url) {
	if ( 60 < url.length ) {
		// strip the querystring
		var hostname = "", dirs = "", filename = "", ext = "", querystring = "";
		if ( url.match( /^(http.*\/\/.*?\/)(.*)$/ ) ) {
			// break it apart
			hostname = RegExp.$1;  // HAS trailing slash
			url = RegExp.$2;
			if ( url.match( /^(.*)(\?.*)$/ ) ) {
				url = RegExp.$1;
				querystring = RegExp.$2;  // HAS leading "?"
			}
			if ( url.match( /^(.*\/)(.*)$/ ) ) {
				dirs = RegExp.$1;  // HAS trailing slash
				url = RegExp.$2;
			}
			if ( url.match( /^(.*)(\..*?)$/ ) && 5 > RegExp.$2.length ) {
				filename = RegExp.$1; // NO trailing "."
				ext = RegExp.$2;      // HAS leading "."
			}
			var hlen = hostname.length, dlen = dirs.length, flen = filename.length, elen = ext.length, qlen = querystring.length;
			// build it back up
			if ( 60 > hlen + dlen + flen + elen ) {
				// trim querystring
				url = hostname + dirs + filename + ext;
				return url + ( qlen ? querystring.substring(0, 57 - url.length) + "..." : "" );
			}
			if ( 64 > hlen + flen + elen ) {
				// trim dirs
				return hostname + dirs.substring(0, (60-(hlen + flen + elen))) + ".../" + filename + ext;
			}
			if ( 60 > hlen ) {
				// trim filename
				return hostname + ( dirs ? ".../" : "" ) + filename.substring(0, (60-(hlen + elen))) + "..." + ext;
			}
			return hostname.substring(0, 53) + ".../...";
		}
	}
	return url;
};
GR.prettyType = function(type) {
	switch(type) {
		case "html": return "HTML";
		case "js": return "Script";
		case "css": return "Stylesheet";
		case "image": return "Image";
		case "cssimage": return "CSS Background Image";
		case "flash": return "Flash";
	}
	return "unrecognized type";
};
GR.findResources = function(doc) {
	GR.findScripts(doc);
	GR.findStylesheets(doc);
	GR.findImages(doc);
	GR.findBgImages(doc);
	GR.findFlash(doc);
};
GR.start = function() {
	GR.init();
	if ( "undefined" != typeof(JDROPVIEW) ) {
		return;
	}
	var subDocs = GR.findHtml(window);
	for ( var i = 0, len = subDocs.length; i < len; i++ ) {
		GR.findResources(subDocs[i]);
	}
	GR.report(window.document);
};
GR.start();
function SaveToJdrop(appname, myDataObj, version, summary) {
	// create object of parameters to pass to Jdrop
	var params = { "appname": appname,
				   "title": document.title,
				   "version": version,
				   "summary": summary,
				   "json": JSON.stringify(myDataObj) };
	// hidden iframe to use as target of form submit
	var jdropif = document.createElement("iframe");
	jdropif.style.display = "none";
	jdropif.name = "jdropiframe";
	jdropif.id = "jdropiframe";
	document.body.appendChild(jdropif);
	// form for posting data
	var jdropform = document.createElement("form");
	jdropform.method = "post";
	jdropform.action = "http://jdrop.org/save";
	jdropform.target = "jdropiframe";
	// add each param to the form as an input field
	for (var key in params) {
		var pInput = document.createElement("input");
		pInput.setAttribute("name", key);
		pInput.setAttribute("value", params[key]);
		jdropform.appendChild(pInput);
	}
	// submit the form and cleanup
	document.body.appendChild(jdropform);
	jdropif.onload = function() { document.body.removeChild(jdropform); document.body.removeChild(jdropif); };
	jdropif.onerror = function() { document.body.removeChild(jdropform); document.body.removeChild(jdropif); };
	jdropform.submit();
}
function JdropCallback(jsonobj) {
	GR.resources = jsonobj;
	GR.report(window.document, true);
}
/*
    http://www.JSON.org/json2.js
    2010-11-17
    Public Domain.
    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
    See http://www.JSON.org/js.html
*/
if(!this.JSON){this.JSON={}}(function(){function f(n){return n<10?"0"+n:n}if(typeof Date.prototype.toJSON!=="function"){Date.prototype.toJSON=function(key){return isFinite(this.valueOf())?this.getUTCFullYear()+"-"+f(this.getUTCMonth()+1)+"-"+f(this.getUTCDate())+"T"+f(this.getUTCHours())+":"+f(this.getUTCMinutes())+":"+f(this.getUTCSeconds())+"Z":null};String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(key){return this.valueOf()}}var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={"\b":"\\b","\t":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},rep;function quote(string){escapable.lastIndex=0;return escapable.test(string)?'"'+string.replace(escapable,function(a){var c=meta[a];return typeof c==="string"?c:"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+string+'"'}function str(key,holder){var i,k,v,length,mind=gap,partial,value=holder[key];if(value&&typeof value==="object"&&typeof value.toJSON==="function"){value=value.toJSON(key)}if(typeof rep==="function"){value=rep.call(holder,key,value)}switch(typeof value){case"string":return quote(value);case"number":return isFinite(value)?String(value):"null";case"boolean":case"null":return String(value);case"object":if(!value){return"null"}gap+=indent;partial=[];if(Object.prototype.toString.apply(value)==="[object Array]"){length=value.length;for(i=0;i<length;i+=1){partial[i]=str(i,value)||"null"}v=partial.length===0?"[]":gap?"[\n"+gap+partial.join(",\n"+gap)+"\n"+mind+"]":"["+partial.join(",")+"]";gap=mind;return v}if(rep&&typeof rep==="object"){length=rep.length;for(i=0;i<length;i+=1){k=rep[i];if(typeof k==="string"){v=str(k,value);if(v){partial.push(quote(k)+(gap?": ":":")+v)}}}}else{for(k in value){if(Object.hasOwnProperty.call(value,k)){v=str(k,value);if(v){partial.push(quote(k)+(gap?": ":":")+v)}}}}v=partial.length===0?"{}":gap?"{\n"+gap+partial.join(",\n"+gap)+"\n"+mind+"}":"{"+partial.join(",")+"}";gap=mind;return v}}if(typeof JSON.stringify!=="function"){JSON.stringify=function(value,replacer,space){var i;gap="";indent="";if(typeof space==="number"){for(i=0;i<space;i+=1){indent+=" "}}else{if(typeof space==="string"){indent=space}}rep=replacer;if(replacer&&typeof replacer!=="function"&&(typeof replacer!=="object"||typeof replacer.length!=="number")){throw new Error("JSON.stringify")}return str("",{"":value})}}if(typeof JSON.parse!=="function"){JSON.parse=function(text,reviver){var j;function walk(holder,key){var k,v,value=holder[key];if(value&&typeof value==="object"){for(k in value){if(Object.hasOwnProperty.call(value,k)){v=walk(value,k);if(v!==undefined){value[k]=v}else{delete value[k]}}}}return reviver.call(holder,key,value)}text=String(text);cx.lastIndex=0;if(cx.test(text)){text=text.replace(cx,function(a){return"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)})}if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,"@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:\s*\[)+/g,""))){j=eval("("+text+")");return typeof reviver==="function"?walk({"":j},""):j}throw new SyntaxError("JSON.parse")}}}());
