// load telegram features
// user info for Telegram sdk 

window.onload = async () => {
    if (window.Telegram.WebApp) {
        window.Telegram.WebApp.expand();
        const { id, firstname, lastname, username, photo_url } = window.Telegram.WebApp.initDataUnsafe.user;
        document.querySelector(".profile__header h1").textContent = `${firstname} ${lastname}`;
        document.querySelector(".profile__header p").textContent = `@${username}`;
        try {
            const response = await fetch(`http://localhost:3000/profiles/${id}`);
            const data = await response.json();
            if (response.ok) {
                const { photo_id } = data;
                document.querySelector(".profile__header img").src = `http://localhost:3000/files/${photo_id}`;
            } else {
                console.warn("error while fetching profile data.");
                document.querySelector(".profile__header img").src = photo_url;
            }
        } catch (error) {
            console.error("error fetching profile data:", error);
            document.querySelector(".profile__header img").src = photo_url;
        }
    } else {
        console.warn("We're not inside Telegram.");
    }
};

// make requeest to upload the new profile picture
// and update the user's profile picture
// by only storing the file_id provided by telegram in our database

document.querySelector("input#fileInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    const { id } = window.Telegram.WebApp.initDataUnsafe.user;

    if (file && id) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.querySelector(".profile__header img").src = e.target.result;
        };
        reader.readAsDataURL(file);

        const formData = new FormData();
        formData.append("chat_id", id);
        formData.append("document", file);

        try {
            const response = await fetch("http://localhost:3000/files", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();
            if (response.ok) {
                console.log("photo has been sucessfull sent to the backend:", data);
            } else {
                console.warn("error while uploading photo:", data.description);
            }
        } catch (error) {
            console.error("error during the request:", error);
        } 
    } else {
        console.warn("no file selected or user id not found.");
    }
});