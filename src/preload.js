const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    const url = window.location.href;
  
    if (url.includes('/pharm/diabetes/calc-detail')) {
      const button = document.querySelector('#updateBtn');
      button.innerText = '자동 청구 시작';

      // Add click event listener to the button
      button.addEventListener('click', () => {
          const patientName = document.querySelector('#patientName').value;
          const patientSSN = document.querySelector('#patientSocialSecurityNumber').value;
          const data = {
          name: patientName,
          ssn: patientSSN
          };
          ipcRenderer.send('start-playwright', data);
      });
    }
  });
