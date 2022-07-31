var uploadstatus = document.getElementById('uploadstatus');
var keyinput = document.getElementById('keyinput');
var fileinput = document.getElementById('fileinput');
var fileInputLabel = document.getElementById('fileInputLabel');
var fileinfo = document.getElementById('fileinfo');

function getCookies() {
    var cookieRegex =
        /([\w\.]+)\s*=\s*(?:"((?:\\"|[^"])*)"|(.*?))\s*(?:[;,]|$)/g;
    var cookies = {};
    var match;
    while ((match = cookieRegex.exec(document.cookie)) !== null) {
        var value = match[2] || match[3];
        cookies[match[1]] = decodeURIComponent(value);
        try {
            cookies[match[1]] = JSON.parse(cookies[match[1]]);
        } catch (err) {}
    }
    return cookies;
}
function deleteCookie(name) {
    document.cookie = name + '= ; expires = Thu, 01 Jan 1970 00:00:00 GMT';
}

var flash = getCookies().flash;
deleteCookie('flash');

if (flash) {
    if (flash.message) {
        if (flash.success) {
            uploadstatus.className = ' success';
            uploadstatus.innerHTML = flash.message;
        } else {
            uploadstatus.className = ' error';
            uploadstatus.textContent = flash.message;
        }
        uploadstatus.style.opacity = 1;
    }
    keyinput.value = flash.key || '';
}
uploadstatus.addEventListener(
    'click',
    function () {
        uploadstatus.style.opacity = 0;
        setTimeout(function () {
            uploadstatus.textContent = '';
            uploadstatus.className = '';
        }, 500);
    },
    false
);
function fileinputChange() {
    if (!fileinput.files[0]) {
        fileinfo.textContent = '';
        return;
    }
    console.log(fileinput.files);
    fileInputLabel.textContent = fileinput.files[0].name;
    fileinfo.textContent = Math.ceil(fileinput.files[0].size / 1024) + ' kB';
}
fileinput.addEventListener('change', fileinputChange, false);
fileinputChange();
