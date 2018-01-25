window.request = function request (method, url, data) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        resolve(xhr.responseText);
      } else {
        reject({
          status: this.status,
          statusText: xhr.responseText
        });
      }
    };
    xhr.onerror = function () {
      reject({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send(data);
  });
}

window.requestGet = function requestGet(path) {
  return window.request('GET', `http://localhost:${window.PORT}${path}`);
};

window.requestPost = function requestGet(path, data) {
  const formData = new FormData();
  for (const key in data) {
    formData.set(key, data[key]);
  }
};
