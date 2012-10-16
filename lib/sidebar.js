const { Cc, Ci } = require("chrome");
const { setInterval, clearTimeout } = require("timers");
const tabs = require("tabs");

// This tries to dynamically recreate the instructions from here
//   https://developer.mozilla.org/en-US/docs/Creating_a_Firefox_sidebar
// And expose toggleSidebar as described here:
//   https://developer.mozilla.org/en-US/docs/Code_snippets/Sidebar

var Sidebar = function (options) {
  var url = options.url;
  if (! url) {
    throw 'You must give a url option';
  }
  var title = options.title || url;
  var name = options.name || url;
  name = name.replace(/[^a-zA-Z0-9]/g, '');
  this.name = name;
  this.url = url;
  this.showForTab = options.showForTab;
  this.onClose = options.onClose;
  this.onReady = options.onReady;
  this.contentScriptFile = options.contentScriptFile;
  var w = getWindow();
  var doc = w.document;
  var container = doc.createElement('broadcasterset');
  var broadcaster = doc.createElement('broadcaster');
  container.id = name + '_container';
  container.appendChild(broadcaster);
  broadcaster.id = name;
  broadcaster.setAttribute('sidebarurl', url);
  broadcaster.setAttribute('sidebartitle', title);
  broadcaster.setAttribute('type', 'checkbox');
  broadcaster.setAttribute('group', 'sidebar');
  doc.getElementById('mainCommandSet').appendChild(container);
  if (! options.hidden) {
    this.show();
  }
  if (this.showForTab) {
    this._tabActivate = this._tabActivate.bind(this);
    tabs.on("activate", this._tabActivate);
  }
  if (this.onClose) {
    this._onClose = this._onClose.bind(this);
    var el = doc.getElementById('sidebar-header');
    var child = el.querySelector('.tabs-closebutton');
    child.addEventListener("click", this._onClose, false);
  }
};

Sidebar.prototype = {

  show: function show() {
    getWindow().toggleSidebar(this.name, true);
    if (this.onReady) {
      this._pollOnReady(this.onReady);
    }
  },

  hide: function hide() {
    var w = getWindow();
    var broadcaster = w.document.getElementById(this.name);
    if (broadcaster.getAttribute('checked') == 'true') {
      w.toggleSidebar();
    }
    // Otherwise the sidebar isn't currently showing
  },

  window: function window() {
    var doc = getWindow().document;
    var sidebar = doc.getElementById('sidebar');
    return sidebar.contentWindow;
  },

  isShowing: function isShowing() {
    var doc = getWindow().document;
    var el = doc.getElementById(this.name);
    return el.getAttribute('checked') == 'true';
  },

  _pollOnReady: function (callback) {
    // For some reason nothing else I try works
    var sidebar = getWindow().document.getElementById('sidebar');
    var url = this.url;
    var id = null;
    function check() {
      if (sidebar.contentDocument.location.href == url && sidebar.contentDocument.readyState == "complete") {
        clearTimeout(id);
        id = null;
        this._addContentScripts();
        callback();
      }
    }
    id = setInterval(check.bind(this), 100);
  },

  _addContentScripts: function _addContentScripts() {
    if (! this.contentScriptFile) {
      return;
    }
    var cs = this.contentScriptFile;
    if (typeof cs == "string") {
      cs = [cs];
    }
    for (var i=0; i<cs.length; i++) {
      var doc = this.window().document;
      var el = doc.createElement('script');
      el.src = cs[i];
      doc.head.appendChild(el);
    }
  },

  _destructor: function _destructor() {
    this.hide();
    var doc = getWindow().document;
    var el = doc.getElementById(this.name + '_container');
    var set = doc.getElementById('mainCommandSet');
    set.removeChild(el);
    if (this.showForTab) {
      tabs.removeListener("activate", this._tabActivate);
    }
    if (this.onClose) {
      var el = doc.getElementById('sidebar-header');
      var child = el.querySelector('.tabs-closebutton');
      child.removeEventListener("click", this._onClose, false);
    }
  },

  destroy: function destroy() {
    this._destructor();
  },

  _tabActivate: function () {
    if (this.showForTab(tabs.activeTab)) {
      this.show();
    } else {
      this.hide();
    }
  },

  _onClose: function (event) {
    this.onClose(event);
  }

};

const windowMediator = Cc['@mozilla.org/appshell/window-mediator;1'].
                       getService(Ci.nsIWindowMediator);

function getWindow() {
  // Roughly based on panel.js's getWindow
   return windowMediator.getMostRecentWindow("navigator:browser");
}

exports.Sidebar = Sidebar;