// make requeest to upload the new profile picture
// and update the user's profile picture
// by only storing the file_id provided by telegram in our database


document.querySelector("input#fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    console.log("getting file...");
    console.log(file);

    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.querySelector(".profile__header img").src = e.target.result;
        }
        reader.readAsDataURL(file); 
    }
});