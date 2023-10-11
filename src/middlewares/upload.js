const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
    destination : (req,file,cb) => {
        return cb(null, 'public/img')
    },
    filename : (req, file, cb) => {
        return cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
    }
})

const uploadOneImage = multer({
    storage
})


module.exports = {uploadOneImage}

