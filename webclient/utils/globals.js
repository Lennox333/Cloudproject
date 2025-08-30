let SERVER = "http://localhost:5000"; // fallback

// Fetch the actual server URL from config.json
let serverReady = fetch("../config.json")
  .then(res => res.json())
  .then(cfg => {
    SERVER = cfg.SERVER;
    console.log("Server URL set to:", SERVER);
  });

// Dynamically fetch without having to rebuild ecr images when ec2 instance is down and then dns changed
const fetchServer = async (path, options = {}) => {
  await serverReady; // ensures SERVER is loaded
  return fetch(`${SERVER}${path}`, options);
};


export {serverReady, SERVER}