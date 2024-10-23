const axios = require("axios");
const config = require('config');
const PHARM_URL = config.get('PHARM_URL');

const sendDelegationToBack = async (
  pharmacyId,
  status,
  message,
  csrfToken,
  csrfHeader
) => {
  try {
    console.log(
      `Status: ${status}, Message: ${message}, csrfToken: ${csrfToken}, csrfHeader: ${csrfHeader}`
    );

    const { manageLocalData } = require("./index");
    const data = await manageLocalData("session");
    const cookieHeader = data
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    const response = await axios.post(
        PHARM_URL+"pharm/diabetes/renew/delegation-list",
      {
        pharmacyId,
        status: status,
        result: message,
      },
      {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/json",
          [csrfHeader]: csrfToken,
        },
      }
    );
    console.log("Response Status:", response.status);
  } catch (error) {
    console.error("Error sending log:", error);
    if (error.response) {
      console.log("Error Response Headers:", error.response.headers);
      console.error("Server responded with:", error.response.data);
    } else {
      console.error("No response from server:", error.message);
    }
  }
};

module.exports = { sendDelegationToBack };
