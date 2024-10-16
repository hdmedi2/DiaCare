const axios = require('axios');

const sendLogToServer = async (docId, status, message, csrfToken, csrfHeader) => {
  try {
    console.log(`Status: ${status}, Message: ${message}, csrfToken: ${csrfToken}, csrfHeader: ${csrfHeader}`);
    
    const { manageLocalData } = require('./index');
    const data = await manageLocalData('session');
    const cookieHeader = data.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    const response = await axios.post('https://pharm.hdmedi.kr/pharm/diabetes/calc-detail/claims',
    {
      pharmacyPatientDiabetesTreatId: docId,
      status: status,
      result: message
    }, {
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
        [csrfHeader]: csrfToken
      }
    });
    console.log('Response Status:', response.status);
  } catch (error) {
    console.error('Error sending log:', error);
    if(error.response){
      console.log('Error Response Headers:', error.response.headers);
      console.error('Server responded with:', error.response.data);
    } else {
      console.error('No response from server:', error.message);
    }
  }
};

module.exports = { sendLogToServer };

const pharmacyListByBizNo = async (cookieData, bizNo) => {
  try {
    let param = {
        'PAY_CLSFC_CD': '3170', //
        'SRCH_TYPE': '3',
        'SRCH_KEY': bizNo
    };

    const cookieHeader = cookieData.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    const url = 'https://medicare.nhis.or.kr/portal/bk/z/300/selectBcbnfSlEntrUnityMgmtList.do';
    const response = await axios.post(url,
        {
          param
        }, {
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'accept-language': 'ko-KR,ko;q=0.9',
            'Connection': 'keep-alive',
            'Content-Type': 'application/json; charset="UTF-8"',
            'Cookie': cookieHeader,
            // 'csrfHeader': csrfToken
          }
        });

    console.log('Response:', response);

    return response.data.data.length;

  } catch (error) {
    console.error('Error sending log:', error);
    if (error.response) {
      console.log('Error Response Headers:', error.response.headers);
      console.error('Server responded with:', error.response.data);
    } else {
      console.error('No response from server:', error.message);
    }

    return 0;
  }

};

module.exports = { pharmacyListByBizNo };