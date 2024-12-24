// make requeest to upload the new profile picture
// and update the user's profile picture
// by only storing the file_id provided by telegram in our database

document.onload = async () => {
    if (window.Telegram.WebApp) {
        window.Telegram.WebApp.expand();
        const { firstname, lastname, username, photo_url } = window.Telegram.WebApp.user;
        document.querySelector(".profile__header img").src = photo_url;
        document.querySelector(".profile__header h1").textContent = `${firstname} ${lastname}`;
        document.querySelector(".profile__header p").textContent = `@${username}`;
    }
};


document.querySelector("input#fileInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.querySelector(".profile__header img").src = e.target.result;
        };
        reader.readAsDataURL(file);

        const formData = new FormData();
        formData.append("chat_id", "1839098668");
        formData.append("document", file);

        try {
            const response = await fetch("http://localhost:3000/files", {
                method: "POST",
                body: formData,
            });

            const data = JSON.parse(response);
            if (data.ok) {
                console.log("photo has been sucessfull sent :", data);
            } else {
                console.warn("error while sending phto:", data.description);
            }
        } catch (error) {
            console.error("error during the request :", error);
        }
    }
});