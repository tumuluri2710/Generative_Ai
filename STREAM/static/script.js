const chatbotToggler = document.querySelector(".chatbot-toggler");
const closeBtn = document.querySelector(".close-btn");
const chatbox = document.querySelector(".chatbox");
const chatInput = document.querySelector(".chat-input textarea");
const sendChatBtn = document.querySelector(".chat-input span");

let userMessage = null;
const inputInitHeight = chatInput.scrollHeight;

const createChatLi = (message, className) => {
    const chatLi = document.createElement("li");
    chatLi.classList.add("chat", `${className}`);
    let chatContent = className === "outgoing" ? `<p></p>` : `<span class="material-symbols-outlined">smart_toy</span><p></p>`;
    chatLi.innerHTML = chatContent;
    chatLi.querySelector("p").textContent = message;
    return chatLi;
}
const generateResponse = (chatElement, response) => {
    const messageElement = chatElement.querySelector("p");
    const formattedResponse = response.replace('/\\/n/g', '\n'); // Replace /n with actual newlines
    console.log(formattedResponse)
    let index = 0;

    messageElement.textContent = ''; // Clear the text content
    chatbox.scrollTo(0, chatbox.scrollHeight); // Scroll to the bottom

    const typingInterval = setInterval(() => {
        if (index < formattedResponse.length) {
            messageElement.textContent += formattedResponse.charAt(index);
            index++;
            chatbox.scrollTo(0, chatbox.scrollHeight); // Keep scrolling to the bottom
        } else {
            clearInterval(typingInterval); // Stop the typing effect when done
        }
    }, 50); // Adjust the typing speed (50 ms per character)
};




const handleChat = () => {
    userMessage = chatInput.value.trim();
    console.log(userMessage)
    if(!userMessage) return;

    // Clear the input textarea and set its height to default
    chatInput.value = "";
    chatInput.style.height = `${inputInitHeight}px`;

    // Append the user's message to the chatbox
    chatbox.appendChild(createChatLi(userMessage, "outgoing"));
    chatbox.scrollTo(0, chatbox.scrollHeight);
    

    try {
        fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: userMessage }),
        })
        .then(response=>response.json())
        .then(data=>{
        
            
             const response=data.response;
            console.log(data)
            setTimeout(() => {
                // Display "Thinking..." message while waiting for the response
                const incomingChatLi = createChatLi("Thinking...", "incoming");
                chatbox.appendChild(incomingChatLi);
                chatbox.scrollTo(0, chatbox.scrollHeight);
            generateResponse(incomingChatLi,response);   
      },100)
    })
    } 
    catch (error) {
    
    console.error('Error:', error);
        incomingChatLi.querySelector("p").textContent = "Error occurred. Please try again.";
    }

}

chatInput.addEventListener("input", () => {
    // Adjust the height of the input textarea based on its content
    chatInput.style.height = `${inputInitHeight}px`;
    chatInput.style.height = `${chatInput.scrollHeight}px`;
});

chatInput.addEventListener("keydown", (e) => {
    // If Enter key is pressed without Shift key and the window
    // width is greater than 800px, handle the chat
    if(e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
        e.preventDefault();
        handleChat();
    }
});

sendChatBtn.addEventListener("click", handleChat);
closeBtn.addEventListener("click", () => document.body.classList.remove("show-chatbot"));
chatbotToggler.addEventListener("click", () => document.body.classList.toggle("show-chatbot"));
