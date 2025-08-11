const random = (min, max) => Math.floor(Math.random() * (max - min)) + min;

const userId = random(1, 100000);

const sse = new EventSource(`/sync-timer?userId=${userId}`);
const timerDiv = document.getElementById("timer");

sse.onmessage = (event)=>{
    console.log(event);
    if (parseInt(event.data) === 0){
        sse.close();
    }
    timerDiv.innerText = event.data;
}

sse.onerror = (errEvent)=>{
    console.log(errEvent);
}