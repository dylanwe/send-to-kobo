const uploadstatus = document.querySelector('#uploadstatus');
const keyinput = document.querySelector('#keyinput');
const fileinput = document.querySelector('#fileinput');
const uploadTitle = document.querySelector('#uploadTitle');
const fileinfo = document.querySelector('#fileinfo');
const uploadBox = document.querySelector('#uploadBox');

const getCookies = () => {
    const cookieRegex =
        /([\w\.]+)\s*=\s*(?:"((?:\\"|[^"])*)"|(.*?))\s*(?:[;,]|$)/g;
    const cookies = {};
    let match;
    while ((match = cookieRegex.exec(document.cookie)) !== null) {
        const value = match[2] || match[3];
        cookies[match[1]] = decodeURIComponent(value);
        try {
            cookies[match[1]] = JSON.parse(cookies[match[1]]);
        } catch (err) {}
    }
    return cookies;
}

const deleteCookie = (name) => {
    document.cookie = name + '= ; expires = Thu, 01 Jan 1970 00:00:00 GMT';
}

const showFlashMessage = () => {
    const flash = getCookies().flash;
    deleteCookie('flash');

    if (flash) {
        if (flash.message) {
            if (flash.success) {
                uploadstatus.className = 'alert alert-success';
                uploadstatus.innerHTML = flash.message;
            } else {
                uploadstatus.className = 'alert alert-danger';
                uploadstatus.textContent = flash.message;
            }
            uploadstatus.style.opacity = 1;
        }
        keyinput.value = flash.key || '';
    }
}
showFlashMessage();

const updateUploadStatus = () => {
    uploadstatus.style.opacity = 0;
    setTimeout(function () {
        uploadstatus.textContent = '';
        uploadstatus.className = '';
    }, 500);
}

const fileinputChange = () => {
    if (!fileinput.files[0]) {
        fileinfo.textContent = '';
        return;
    }
    
    uploadTitle.textContent = fileinput.files[0].name;
    fileinfo.textContent = Math.ceil(fileinput.files[0].size / 1024) + ' KB';
}

const doFileDrop = (files) => {
    fileinfo.textContent = '';
    const allowedTypes = [
        'application/epub+zip',
        'application/pdf',
        'application/vnd.comicbook+zip',
        'application/vnd.comicbook-rar',
    ];

    if (files.length > 1) {
        uploadTitle.textContent = 'You can only upload one file at the time';
        return;
    }

    if (allowedTypes.includes(files[0].type)) {
        fileinput.files = files;
        uploadTitle.textContent = fileinput.files[0].name;
        fileinfo.textContent =
            Math.ceil(fileinput.files[0].size / 1024) + ' kB';
        return;
    }
    
    uploadTitle.textContent = `File of ${files[0].type} not allowed`;
}

uploadstatus.addEventListener('click', updateUploadStatus);

fileinput.addEventListener('change', fileinputChange, false);

uploadBox.addEventListener('click', () => {
    fileinput.click();
});

uploadBox.addEventListener('dragover', (event) => {
    event.preventDefault();
});

uploadBox.addEventListener('drop', (event) => {
    event.preventDefault();
    doFileDrop(event.dataTransfer.files)
});