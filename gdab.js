window.onbeforeunload = function() {
  setTimeout(function() {
    window.stop();
  }, 1);
};

window.open = function() {
  return null;
};

window.confirm = function() {
  return false;
};

window.alert = function() {};

const currentOrigin = window.location.origin;

function isAllowed(url) {
  if (!url) return true;
  if (/^(data|blob|about):/.test(url)) return true;
  try {
    const parsed = new URL(url, currentOrigin);
    const hostname = parsed.hostname;
    if (hostname === 'gamedistribution.com' || hostname.endsWith('.gamedistribution.com')) {
      return false;
    }
    return true;
  } catch (e) {
    return true;
  }
}

const originalFetch = window.fetch;
window.fetch = function(resource, options) {
  const url = resource instanceof Request ? resource.url : resource;
  if (isAllowed(url)) {
    return originalFetch.apply(this, arguments);
  }
  console.error("BLOCKED REQUEST:", url);
  return Promise.reject(new Error("REQUEST BLOCKED"));
};

const originalXHR = window.XMLHttpRequest;
window.XMLHttpRequest = function() {
  const xhr = new originalXHR();
  const originalOpen = xhr.open;
  const originalSend = xhr.send;

  xhr.open = function(method, url) {
    xhr._blockedUrl = !isAllowed(url) ? url : null;
    return originalOpen.apply(this, arguments);
  };

  xhr.send = function(body) {
    if (xhr._blockedUrl) {
      console.error("BLOCKED REQUEST:", xhr._blockedUrl);
      Object.defineProperty(xhr, 'status', { value: 0, writable: true });
      Object.defineProperty(xhr, 'statusText', { value: 'Error', writable: true });
      Object.defineProperty(xhr, 'readyState', { value: 4, writable: true });
      
      setTimeout(function() {
        xhr.dispatchEvent(new Event('error'));
        xhr.dispatchEvent(new Event('readystatechange'));
      }, 0);
      return;
    }
    return originalSend.apply(this, arguments);
  };

  return xhr;
};

function shimSrc(target, Prototype, logMessage) {
  const descriptor = Object.getOwnPropertyDescriptor(Prototype.prototype, 'src');
  Object.defineProperty(target, 'src', {
    configurable: true,
    enumerable: true,
    get: function() {
      return descriptor.get.call(this);
    },
    set: function(value) {
      if (isAllowed(value)) {
        descriptor.set.call(this, value);
      } else {
        console.error(logMessage, value);
      }
    }
  });
}

const originalImage = window.Image;
window.Image = function() {
  const img = new originalImage(...arguments);
  shimSrc(img, HTMLImageElement, "BLOCKED IMAGE:");
  return img;
};

const originalCreateElement = document.createElement;
document.createElement = function(tagName) {
  const element = originalCreateElement.apply(document, arguments);
  const tag = tagName.toLowerCase();
  
  if (tag === 'script') {
    shimSrc(element, HTMLScriptElement, "BLOCKED SCRIPT:");
  } else if (tag === 'iframe') {
    shimSrc(element, HTMLIFrameElement, "BLOCKED IFRAME:");
  } else if (tag === 'img') {
    shimSrc(element, HTMLImageElement, "BLOCKED IMAGE:");
  }
  
  return element;
};

const originalSendBeacon = navigator.sendBeacon;
navigator.sendBeacon = function(url, data) {
  if (isAllowed(url)) {
    return originalSendBeacon.apply(this, arguments);
  }
  console.error("BLOCKED REQUEST:", url);
  return false;
};

const originalWebSocket = window.WebSocket;
window.WebSocket = function(url, protocols) {
  if (isAllowed(url)) {
    return new originalWebSocket(url, protocols);
  }
  console.error("BLOCKED CONNECTION:", url);
  return {
    url: url,
    readyState: 3,
    send: function() {},
    close: function() {},
    addEventListener: function() {},
    removeEventListener: function() {},
    dispatchEvent: function() { return false; }
  };
};

console.log("GDAB is running!");
console.log("GDAB, by syncintellect @ github, and maintained by q8j-dev in conjuction with endlessguyin @ github!");
