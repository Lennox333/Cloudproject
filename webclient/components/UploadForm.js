export const UploadForm = `
    <h2>Upload Video</h2>

    <form id="video-upload-form">
    <label for="video-title">Video Title:</label><br>
    <input type="text" id="video-title" name="title" required /><br><br>

    <label for="video-file">Choose Video File:</label><br>
    <input type="file" id="video-file" name="video" accept="video/*" required /><br><br>

    <label for="thumbnail-file">Choose Thumbnail (DO NOT USE):</label><br>
    <input type="file" id="thumbnail-file" name="thumbnail" accept="image/*" /><br><br>

    <button type="submit">Upload</button>
    </form>

    <div id="upload-message"></div>
`;
