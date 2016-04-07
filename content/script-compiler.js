Components.utils.import('chrome://ferramentasbacenjud/content/xmlhttprequester.js');
Components.utils.import('chrome://ferramentasbacenjud/content/hitch.js');

var ferramentasbacenjud_gmCompiler={

// getUrlContents adapted from Greasemonkey Compiler
// http://www.letitblog.com/code/python/greasemonkey.py.txt
// used under GPL permission
//
// most everything else below based heavily off of Greasemonkey
// http://greasemonkey.devjavu.com/
// used under GPL permission

getUrlContents: function(aUrl){
    var    ioService=Components.classes["@mozilla.org/network/io-service;1"]
        .getService(Components.interfaces.nsIIOService);
    var    scriptableStream=Components
        .classes["@mozilla.org/scriptableinputstream;1"]
        .getService(Components.interfaces.nsIScriptableInputStream);
    var unicodeConverter=Components
        .classes["@mozilla.org/intl/scriptableunicodeconverter"]
        .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    unicodeConverter.charset="UTF-8";

    var    channel=ioService.newChannel(aUrl, null, null);
    var    input=channel.open();
    scriptableStream.init(input);
    var    str=scriptableStream.read(input.available());
    scriptableStream.close();
    input.close();

    try {
        return unicodeConverter.ConvertToUnicode(str);
    } catch (e) {
        return str;
    }
},

isGreasemonkeyable: function(url) {
    var scheme=Components.classes["@mozilla.org/network/io-service;1"]
        .getService(Components.interfaces.nsIIOService)
        .extractScheme(url);
    return (
        (scheme == "http" || scheme == "https" || scheme == "file") &&
        !/hiddenWindow\.html$/.test(url)
    );
},

contentLoad: function(e) {
    var unsafeWin=e.target.defaultView;
    if (unsafeWin.wrappedJSObject) unsafeWin=unsafeWin.wrappedJSObject;

    var unsafeLoc=new XPCNativeWrapper(unsafeWin, "location").location;
    var href=new XPCNativeWrapper(unsafeLoc, "href").href;

    if (
        ferramentasbacenjud_gmCompiler.isGreasemonkeyable(href)
        && ( /https:\/\/www3\.bcb\.gov\.br\/bacenjud2\/.*/.test(href) )
        && true
    ) {
        var scriptPath = 'chrome://ferramentasbacenjud/content/ferramentasbacenjud.js';
        var script=ferramentasbacenjud_gmCompiler.getUrlContents(
            scriptPath
        );
        ferramentasbacenjud_gmCompiler.injectScript(script, href, unsafeWin, scriptPath);
    }
},

injectScript: function(script, url, unsafeContentWin, scriptPath) {
    var sandbox, script, logger, storage, xmlhttpRequester;
    var safeWin=new XPCNativeWrapper(unsafeContentWin);

    sandbox=new Components.utils.Sandbox(safeWin);

    var storage=new ferramentasbacenjud_PrefManager();
    xmlhttpRequester=new GM_xmlhttpRequester(
        safeWin, url, sandbox
    );

    sandbox.window=safeWin;
    sandbox.document=sandbox.window.document;
    sandbox.unsafeWindow=unsafeContentWin;

    // patch missing properties on xpcnw
    sandbox.XPathResult=Components.interfaces.nsIDOMXPathResult;

    // add our own APIs
    sandbox.GM_addStyle=hitch(this, "addStyle", sandbox.document);
    sandbox.GM_setValue=hitch(storage, "setValue");
    sandbox.GM_getValue=hitch(storage, "getValue");
    sandbox.GM_openInTab=hitch(this, "openInTab", unsafeContentWin);
    sandbox.GM_xmlhttpRequest=hitch(xmlhttpRequester, "contentStartRequest");
    //unsupported
    sandbox.GM_registerMenuCommand=function(){};
    Components.utils.import("resource://gre/modules/devtools/Console.jsm");
    sandbox.GM_log=hitch(console, "log");
    sandbox.GM_getResourceURL=function(){};
    sandbox.GM_getResourceText=function(){};

    try {
        this.evalInSandbox(
            "(function(){"+script+"})()",
            url,
            sandbox);
    } catch (e) {
        var e2=new Error(typeof e=="string" ? e : e.message);
        e2.fileName=scriptPath;
        e2.lineNumber=(typeof e=="string" ? 0 : e.lineNumber);
        //GM_logError(e2);
        throw e2;
    }
},

evalInSandbox: function(code, codebase, sandbox) {
    if (Components.utils && Components.utils.Sandbox) {
        // DP beta+
        Components.utils.evalInSandbox(code, sandbox);
    } else if (Components.utils && Components.utils.evalInSandbox) {
        // DP alphas
        Components.utils.evalInSandbox(code, codebase, sandbox);
    } else if (Sandbox) {
        // 1.0.x
        evalInSandbox(code, sandbox, codebase);
    } else {
        throw new Error("Could not create sandbox.");
    }
},

openInTab: function(unsafeContentWin, url) {
    var tabBrowser = getBrowser(), browser, isMyWindow = false;
    for (var i = 0; browser = tabBrowser.browsers[i]; i++)
        if (browser.contentWindow == unsafeContentWin) {
            isMyWindow = true;
            break;
        }
    if (!isMyWindow) return;
 
    var loadInBackground, sendReferrer, referrer = null;
    loadInBackground = tabBrowser.mPrefs.getBoolPref("browser.tabs.loadInBackground");
    sendReferrer = tabBrowser.mPrefs.getIntPref("network.http.sendRefererHeader");
    if (sendReferrer) {
        var ios = Components.classes["@mozilla.org/network/io-service;1"]
                            .getService(Components.interfaces.nsIIOService);
        referrer = ios.newURI(content.document.location.href, null, null);
     }
     tabBrowser.loadOneTab(url, referrer, null, null, loadInBackground);
 },
 
addStyle:function(doc, css) {
    var head, style;
    head = doc.getElementsByTagName('head')[0];
    if (!head) { return; }
    style = doc.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    head.appendChild(style);
},

onLoad: function() {
    var    appcontent=window.document.getElementById("appcontent");
    if (appcontent && !appcontent.greased_ferramentasbacenjud_gmCompiler) {
        appcontent.greased_ferramentasbacenjud_gmCompiler=true;
        appcontent.addEventListener("DOMContentLoaded", ferramentasbacenjud_gmCompiler.contentLoad, false);
    }
},

onUnLoad: function() {
    //remove now unnecessary listeners
    window.removeEventListener('load', ferramentasbacenjud_gmCompiler.onLoad, false);
    window.removeEventListener('unload', ferramentasbacenjud_gmCompiler.onUnLoad, false);
    window.document.getElementById("appcontent")
        .removeEventListener("DOMContentLoaded", ferramentasbacenjud_gmCompiler.contentLoad, false);
},

}; //object ferramentasbacenjud_gmCompiler



window.addEventListener('load', ferramentasbacenjud_gmCompiler.onLoad, false);
window.addEventListener('unload', ferramentasbacenjud_gmCompiler.onUnLoad, false);
