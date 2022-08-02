var keyOutput = document.getElementById('key');
var keyGenBtn = document.getElementById('keygen');
var downloads = document.getElementById('downloads');
var downloadlink = document.getElementById('downloadlink');
var key = null;
var pollTimer = null;

function xhr(method, url, cb) {
    var x = new XMLHttpRequest();
    x.onload = function () {
        cb(x);
    };
    x.onerror = function () {
        cb(x);
    };
    x.open(method, url, true);
    x.send(null);
}

function pollFile() {
    xhr('GET', '/status/' + key, function (x) {
        var data;
        try {
            data = JSON.parse(x.responseText);
        } catch (err) {
            keyOutput.textContent = '----';
            key = null;
            downloads.style.display = 'none';
            return;
        }
        if (data.error) {
            if (pollTimer) clearInterval(pollTimer);
            key = null;
            keyOutput.textContent = '----';
            downloads.style.display = 'none';
        }
        if (data.file) {
            downloadlink.textContent = data.file.name;
            downloads.style.display = 'block';
        } else {
            downloads.style.display = 'none';
        }
    });
}

function generateKey() {
    keyOutput.textContent = '----';
    if (pollTimer) clearInterval(pollTimer);
    downloads.style.display = 'none';
    xhr('POST', '/generate', function (x) {
        if (x.responseText !== 'error' && x.status === 200) {
            key = x.responseText;
            keyOutput.textContent = key;
            downloadlink.href = '/download/' + key;
            if (pollTimer) clearInterval(pollTimer);
            pollTimer = setInterval(pollFile, 5 * 1000);
        } else {
            keyOutput.textContent = '----';
            key = null;
            downloadlink.href = '';
        }
        keyGenBtn.blur();
    });
}

window.onload = function () {
    keyGenBtn.onclick = generateKey;
    generateKey();
};
