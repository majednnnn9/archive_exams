const express = require('express');
const path = require('path');
require('dotenv').config();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const app = express();
const PORT = process.env.PORT || 3000;

// إعداد المجلد العام
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
const pool = require('./config/database');

// إعداد multer للتخزين المؤقت
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // حد 5 ميجابايت لكل ملف
    }
});

app.get('/', async (req, res) => {
    const subjects = await pool.execute('SELECT * FROM `subjects`');
    res.render("index.ejs", { result: subjects[0] });
});
app.use((req, res, next) => {
    res.render("404")
});
app.get('/view-exams', async (req, res) => {
    const id = req.query.id;
    const filesSub = await pool.execute('SELECT * FROM `photos` WHERE sub_id = ? AND active = 1', [id])
    res.render("view_exams.ejs", { result: filesSub[0] });
});


// دالة مساعدة لرفع الصورة إلى ImgBB
async function uploadToImgBB(imageBuffer) {
    try {
        const formData = new FormData();
        formData.append('image', imageBuffer.toString('base64'));

        const response = await axios.post(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`, formData);
        return response.data.data.url;
    } catch (error) {
        console.error('خطأ في رفع الصورة إلى ImgBB:', error);
        throw error;
    }
}

app.post('/upload-photos', upload.array('images', 10), async (req, res) => {
    try {
        const sub_id = req.body.courseId;
        const files = req.files;

        // رفع كل صورة إلى ImgBB وتخزين الرابط في قاعدة البيانات
        for (const file of files) {
            const imageUrl = await uploadToImgBB(file.buffer);

            await pool.execute(
                'INSERT INTO `photos`(`sub_id`, `file_name` , `active`) VALUES (?, ?, 1);',
                [sub_id, imageUrl]
            );
        }

        res.json({ success: true, message: 'تم رفع الصور بنجاح' });
    } catch (error) {
        console.error('خطأ:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ أثناء رفع الصور' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
