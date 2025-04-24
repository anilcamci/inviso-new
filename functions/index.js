const functions = require('firebase-functions');
const admin = require('firebase-admin');
const serviceAccount = require("./Inviso-admin-key.json");
const cors = require('cors')({origin: true});

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const bucket = admin.storage().bucket('inviso-c8758.appspot.com');

exports.deleteFilesAfterSessionClose = functions.https.onRequest((req, res) => {
    cors(req, res, () => {
      if (req.method !== 'POST') {
        return res.status(500).json({ message: 'Not allowed.' });
      }
      const roomCode = req.body.roomCode;
      console.log(`Room code: ${roomCode}`);
      
      const prefix = `${roomCode}/soundObjects/`;
      bucket.deleteFiles({
          prefix: prefix
      }, function(err) {
          if(err){
              console.error('Error while deleting files:', err);
              return res.status(500).json({ error: err.toString() });
          } else {
              console.log(`Files in ${prefix} deleted successfully.`);
              return res.status(200).send(`Files in ${prefix} deleted successfully.`);
          }
      });
    });
  });

// ^ cloud function needs to call this when user leaves room and there's no more users

exports.getTotalSize = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        const sizes = {};
        let totalSize = 0;

        const [files] = await bucket.getFiles({
            prefix: '',
            autoPaginate: true
        });

        const metadataPromises = files.map(file => file.getMetadata());

        const metadataArray = await Promise.all(metadataPromises);
        metadataArray.forEach(metadata => {
            const size = parseInt(metadata[0].size, 10);
            totalSize += size;

            const path = metadata[0].name;
            const subdirectory = path.split('/')[0];
            if (!sizes[subdirectory]) {
                sizes[subdirectory] = 0;
            }
            sizes[subdirectory] += size;
        });

        const numSubdirectories = Object.keys(sizes).length;

        for (let subdirectory in sizes) {
            sizes[subdirectory] = (sizes[subdirectory] / (1024 * 1024)).toFixed(2);
        }
        totalSize = (totalSize / (1024 * 1024)).toFixed(2);

        res.json({
            numSubdirectories: numSubdirectories,
            sizes: sizes,
            totalSize: totalSize
        });
    });
});

// ^ needs to run client-side and then prevent additional data from uploading
// server-side permissions to actually block the room once at a certain size
// file size limit on client-side