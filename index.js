const express = require('express');
const path = require('path');
require('dotenv').config();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
const pool = require('./config/database');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

app.get('/', async (req, res) => {
    try {
        const specializationId = req.query.spec_id;
        const sortType = req.query.sort || 'asc'; // القيمة الافتراضية للترتيب

        const specialization = await pool.execute(`SELECT * FROM specialization`);

        let query = 'SELECT * FROM `subjects`';
        const queryParams = [];

        // إضافة فلتر القسم إذا تم تحديده
        if (specializationId) {
            query += ' WHERE spec_id = ?';
            queryParams.push(specializationId);
        }

        // إضافة الترتيب
        switch (sortType) {
            case 'asc':
                query += ' ORDER BY name_ar ASC';
                break;
            case 'desc':
                query += ' ORDER BY name_ar DESC';
                break;
            case 'oldest':
                query += ' ORDER BY created_at ASC';
                break;
            case 'newest':
                query += ' ORDER BY created_at DESC';
                break;
            default:
                query += ' ORDER BY name_ar ASC';
        }

        const subjects = await pool.execute(query, queryParams);
        console.log(query)
   
        res.render("index.ejs", {
            result: subjects[0],
            specialization: specialization[0],
            selectedSpec: specializationId,
            sortType: sortType
        });
        // console.log({ 
        //     result: subjects[0], 
        //     specialization: specialization[0],
        //     currentSpec: specializationId,
        //     currentSort: sortType
        // })
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('حدث خطأ في الخادم');
    }
});

app.get('/view-exams', async (req, res) => {
    const id = req.query.id;
    await pool.execute('UPDATE subjects SET `views` = `views` + 1 WHERE subjects.id = ? ; ', [id])
    const filesSub = await pool.execute('SELECT * FROM `photos` WHERE sub_id = ? AND active = 1', [id])
    res.render("view_exams.ejs", { result: filesSub[0], });
});

app.get('/add-exam', async (req, res) => {
    const filesSub = await pool.execute(`SELECT * FROM subjects`)
    res.render('add_photos', { result: filesSub[0] })
});

app.get('/view-subjects', async (req, res) => {
    const filesSub = await pool.execute('SELECT  m.id,  m.name_ar,  m.views  , m.name_en, COUNT(i.id) AS image_count FROM subjects m LEFT JOIN photos i  ON m.id = i.sub_id   GROUP BY m.id, m.name_ar, m.name_en;')
    res.render('veiw_subjects', { result: filesSub[0] })
});

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
