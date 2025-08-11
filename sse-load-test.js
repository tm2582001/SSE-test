const EventSource = require('eventsource');
const axios = require('axios');
const fs = require('fs');

// const BASE_URL = 'https://sse-test-hpxe.onrender.com';
const BASE_URL = 'https://sse-test-production.up.railway.app';
const CONCURRENT_USERS = 20000;

// Error logging setup
const ERROR_LOG_FILE = 'error-log.txt';

// Clear error log at start of test
fs.writeFileSync(ERROR_LOG_FILE, `=== Load Test Error Log Started at ${new Date().toISOString()} ===\n\n`);

function logErrorToFile(errorType, errorDetails) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${errorType}:\n${JSON.stringify(errorDetails, null, 2)}\n\n`;
  fs.appendFileSync(ERROR_LOG_FILE, logEntry);
}

// Metrics tracking
const metrics = {
  totalUsers: 0,
  sseConnections: 0,
  sseErrors: 0,
  sseErrorDetails: [], // Detailed SSE error logs
  postRequests: 0,
  postSuccesses: 0,
  postErrors: 0,
  postErrorDetails: [], // Detailed POST error logs
  responseTimes: [],
  slowResponses: [], // Responses > 5 seconds
  verySlowResponses: [], // Responses > 10 seconds
  startTime: Date.now()
};

class TestUser {
  constructor(userId) {
    this.userId = userId;
    this.connected = false;
    this.postInterval = null;
    this.postCount = 0;
    
    this.startTest();
  }
  
  startTest() {
    console.log(`🔌 User ${this.userId}: Starting SSE connection...`);
    
    // Start SSE connection
    this.sse = new EventSource(`${BASE_URL}/sync-timer?userId=${this.userId}`);
    
    this.sse.onopen = () => {
      console.log(`✅ User ${this.userId}: SSE connected`);
      this.connected = true;
      metrics.sseConnections++;
      
      // Start sending POST requests every 3-8 seconds
      this.startPostRequests();
    };
    
    this.sse.onmessage = (event) => {
      const data = event.data.trim();
      
      if (data === '0') {
        console.log(`⏰ User ${this.userId}: Received "0" - Test ended`);
        this.endTest();
      } else {
        console.log(`📊 User ${this.userId}: Received countdown ${data}`);
      }
    };
    
    this.sse.onerror = (error) => {
      const errorDetails = {
        userId: this.userId,
        timestamp: new Date().toISOString(),
        message: error.message || 'Connection error',
        type: error.type || 'unknown',
        readyState: this.sse.readyState
      };
      
      metrics.sseErrors++;
      metrics.sseErrorDetails.push(errorDetails);
      
      // Log error to file
      logErrorToFile('SSE_ERROR', errorDetails);
      
      console.log(`❌ User ${this.userId}: SSE error -`, error.message || 'Connection error');
      this.endTest();
    };
  }
  
  startPostRequests() {
    const sendPost = () => {
      if (!this.connected) return;
      
      this.postCount++;
      const startTime = Date.now();
      
      console.log(`📤 User ${this.userId}: Sending POST #${this.postCount}`);
      metrics.postRequests++;
      
      const postData = {
        answers: {
          question1: `answer1_${this.postCount}`,
          question2: `answer2_${this.postCount}`,
          timestamp: new Date().toISOString()
        }
      };
      
      axios.post(`${BASE_URL}/save-answers?userId=${this.userId}`, postData, {
        headers: { 'Content-Type': 'application/json' }
        // No timeout - let it take as long as it needs
      })
      .then(response => {
        const duration = Date.now() - startTime;
        metrics.responseTimes.push(duration);
        metrics.postSuccesses++;
        
        // Track slow responses
        if (duration > 10000) {
          metrics.verySlowResponses.push({ userId: this.userId, postCount: this.postCount, duration });
          console.log(`🐌 User ${this.userId}: POST #${this.postCount} VERY SLOW (${response.status}) - ${duration}ms`);
        } else if (duration > 5000) {
          metrics.slowResponses.push({ userId: this.userId, postCount: this.postCount, duration });
          console.log(`⚠️ User ${this.userId}: POST #${this.postCount} SLOW (${response.status}) - ${duration}ms`);
        } else {
          console.log(`✅ User ${this.userId}: POST #${this.postCount} success (${response.status}) - ${duration}ms`);
        }
      })
      .catch(error => {
        const duration = Date.now() - startTime;
        
        const errorDetails = {
          userId: this.userId,
          postCount: this.postCount,
          timestamp: new Date().toISOString(),
          duration: duration,
          status: error.response?.status || 'No Status',
          message: error.message,
          code: error.code || 'Unknown',
          data: error.response?.data || null
        };
        
        metrics.postErrors++;
        metrics.postErrorDetails.push(errorDetails);
        
        // Log error to file
        logErrorToFile('POST_ERROR', errorDetails);
        
        console.log(`❌ User ${this.userId}: POST #${this.postCount} failed - ${error.response?.status || error.message} - ${duration}ms`);
      });
      
      // Schedule next POST request (random interval)
      if (this.connected) {
        const nextDelay = 3000 + Math.random() * 5000; // 3-8 seconds
        this.postInterval = setTimeout(sendPost, nextDelay);
      }
    };
    
    // Send first POST after 2 seconds
    this.postInterval = setTimeout(sendPost, 2000);
  }
  
  endTest() {
    this.connected = false;
    
    if (this.postInterval) {
      clearTimeout(this.postInterval);
    }
    
    if (this.sse) {
      this.sse.close();
    }
    
    console.log(`🏁 User ${this.userId}: Test completed - Sent ${this.postCount} POST requests`);
  }
}

// Start the load test
console.log(`🚀 Starting load test with ${CONCURRENT_USERS} concurrent users`);
console.log(`📊 Target: ${BASE_URL}`);
console.log('─'.repeat(80));

const users = [];
for (let i = 0; i < CONCURRENT_USERS; i++) {
  const userId = Math.floor(Math.random() * 900000) + 100000;
  metrics.totalUsers++;
  
  // Stagger user creation to avoid overwhelming the server
  setTimeout(() => {
    users.push(new TestUser(userId));
    
    // Check if this was the last user
    if (users.length === CONCURRENT_USERS) {
      checkAllUsersCreated();
    }
  }, i * 50); // 50ms delay between each user
}

// Print metrics every 30 seconds
const metricsInterval = setInterval(() => {
  const elapsed = Math.round((Date.now() - metrics.startTime) / 1000);
  const avgResponseTime = metrics.responseTimes.length > 0 
    ? Math.round(metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length)
    : 0;
  
  console.log('\n📈 METRICS UPDATE:');
  console.log(`⏱  Elapsed: ${elapsed}s`);
  console.log(`👥 Users: ${metrics.totalUsers} total, ${metrics.sseConnections} connected`);
  console.log(`📊 SSE: ${metrics.sseConnections} connections, ${metrics.sseErrors} errors`);
  console.log(`📤 POST: ${metrics.postRequests} total, ${metrics.postSuccesses} success, ${metrics.postErrors} errors`);
  console.log(`⚡ Avg Response Time: ${avgResponseTime}ms`);
  console.log(`🐌 Slow Responses (>5s): ${metrics.slowResponses.length}`);
  console.log(`🐌 Very Slow (>10s): ${metrics.verySlowResponses.length}`);
  console.log('─'.repeat(50));
}, 30000);

// Wait for all users to be created, then run for additional time
let allUsersCreated = false;
const checkAllUsersCreated = () => {
  if (users.length >= CONCURRENT_USERS && !allUsersCreated) {
    allUsersCreated = true;
    console.log(`\n✅ All ${CONCURRENT_USERS} users created! Running for additional 120 seconds...`);
    
    // Now start the cleanup timer after all users are created
    setTimeout(() => {
  console.log('\n🏁 Test completed - Final metrics:');
  
  users.forEach(user => user.endTest());
  clearInterval(metricsInterval);
  
  const totalTime = Math.round((Date.now() - metrics.startTime) / 1000);
  const avgResponseTime = metrics.responseTimes.length > 0 
    ? Math.round(metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length)
    : 0;
  
  const successRate = metrics.postRequests > 0 
    ? Math.round((metrics.postSuccesses / metrics.postRequests) * 100)
    : 0;
  
  console.log(`📊 FINAL RESULTS:`);
  console.log(`⏱  Total Time: ${totalTime}s`);
  console.log(`👥 Users: ${metrics.totalUsers}`);
  console.log(`🔌 SSE Connections: ${metrics.sseConnections} (${metrics.sseErrors} errors)`);
  console.log(`📤 POST Requests: ${metrics.postRequests}`);
  console.log(`✅ Success Rate: ${successRate}%`);
  console.log(`⚡ Average Response Time: ${avgResponseTime}ms`);
  console.log(`📈 Requests/sec: ${Math.round(metrics.postRequests / totalTime)}`);
  
  // Detailed slow response analysis
  if (metrics.slowResponses.length > 0) {
    console.log(`\n🐌 SLOW RESPONSES (5-10s):`);
    metrics.slowResponses.forEach(r => {
      console.log(`   User ${r.userId}, POST #${r.postCount}: ${r.duration}ms`);
    });
  }
  
  if (metrics.verySlowResponses.length > 0) {
    console.log(`\n🐌🐌 VERY SLOW RESPONSES (>10s):`);
    metrics.verySlowResponses.forEach(r => {
      console.log(`   User ${r.userId}, POST #${r.postCount}: ${r.duration}ms`);
    });
  }
  
  // Response time distribution
  if (metrics.responseTimes.length > 0) {
    const sorted = [...metrics.responseTimes].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const max = sorted[sorted.length - 1];
    
    console.log(`\n📊 RESPONSE TIME DISTRIBUTION:`);
    console.log(`   50th percentile (median): ${p50}ms`);
    console.log(`   95th percentile: ${p95}ms`);
    console.log(`   99th percentile: ${p99}ms`);
    console.log(`   Maximum: ${max}ms`);
  }
  
  // Detailed error analysis
  if (metrics.sseErrorDetails.length > 0) {
    console.log(`\n❌ SSE ERROR DETAILS:`);
    metrics.sseErrorDetails.forEach((err, index) => {
      console.log(`   ${index + 1}. User ${err.userId} at ${err.timestamp}`);
      console.log(`      Message: ${err.message}`);
      console.log(`      Type: ${err.type}, ReadyState: ${err.readyState}`);
    });
  }
  
  if (metrics.postErrorDetails.length > 0) {
    console.log(`\n❌ POST REQUEST ERROR DETAILS:`);
    metrics.postErrorDetails.forEach((err, index) => {
      console.log(`   ${index + 1}. User ${err.userId}, POST #${err.postCount} at ${err.timestamp}`);
      console.log(`      Status: ${err.status}, Duration: ${err.duration}ms`);
      console.log(`      Message: ${err.message}`);
      console.log(`      Code: ${err.code}`);
      if (err.data) {
        console.log(`      Response Data: ${JSON.stringify(err.data)}`);
      }
    });
  }
  
  if (metrics.sseErrorDetails.length === 0 && metrics.postErrorDetails.length === 0) {
    console.log(`\n✅ NO ERRORS DETECTED - Perfect test run!`);
  }
  
  process.exit(0);
    }, 120000); // 120 seconds after all users are created
  }
};

// Check every 5 seconds if all users are created
const creationCheckInterval = setInterval(() => {
  checkAllUsersCreated();
  if (allUsersCreated) {
    clearInterval(creationCheckInterval);
  }
}, 5000);