const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  send: (channel, data_1) => ipcRenderer.send(channel, data_1),
  receive: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
});

window.addEventListener('DOMContentLoaded', () => {
  const url = window.location.href;

  if (url.includes('/pharm/diabetes/calc-update') || url.includes('/pharm/diabetes/calc-detail')) { 
    const button = document.querySelector('#autoBillBtn'); //id="autoBillBtn"
    button.innerText = '자동 청구 시작';

    const button_delegation = document.querySelector('#delegationBtn');
    button_delegation.innerText = "위임 등록하기"

    // Add click event listener to the button
    button.addEventListener('click', () => {
      const patientName = document.querySelector('#patientName').value;
      const patientSSN = document.querySelector('#patientSocialSecurityNumber').value;
      const issueDate = document.querySelector("#prescriptionDate").value;
      const selectElement = document.querySelector('#diabetesPatientBenefitTypeCd');
      const selectedText = selectElement.options[selectElement.selectedIndex].textContent;
      const hospitalNumber = document.querySelector("#hospitalCareOrgNo").value;
      const doctorNumber = document.querySelector("#doctorLicenseNo").value;
      // const departmentName = document.querySelector("#").value;
      const bloodNumber = document.querySelector("#bloodGlucoseTestNumber").value;
      const insulinNumber = document.querySelector("#insulinInjectionNumber").value;
      const diseaseCode = document.querySelector("#diseaseCodeName").value;
      const purchaseDate = document.querySelector("#createdDate").value;
      const eatDays = document.querySelector("#eatDays").value;
      const productNames = Array.from(document.querySelectorAll('td.align-middle.ellipsis-w-100 span.pm-normal-text')).map(span => span.textContent.trim());
      const productPrices = [];
      const productQuantities = [];
      let i = 0;
      while (true) {
        const prices = Array.from(document.querySelectorAll(`#diabetesSuppliesResDtoList${i}\\.unitPrice`)).map(element => element.value);
        const quantities = Array.from(document.querySelectorAll(`#diabetesSuppliesResDtoList${i}\\.quantity`)).map(element => element.value);
        productPrices.push(...prices);
        productQuantities.push(...quantities);
        if (prices.length === 0 && quantities.length === 0) {
          break;
        }
        i++;
      }

      const data = {
        // 환자이름
        name: patientName,
        // 주민번호
        ssn: patientSSN,
        // 처방일자
        issue: issueDate,
        // 당뇨 유형 | 투여 여부 | 기타
        select: selectedText,
        // 요양기관 번호
        hospital: hospitalNumber,
        // 의사면허 번호
        doctor: doctorNumber,
        // 전문의 번호
        // department: departmentName,
        // 혈당검사 횟수
        blood: bloodNumber,
        // 인슐린검사 횟수
        insulin: insulinNumber,
        // 상병코드
        code: diseaseCode,
        // 구매일
        purchase: purchaseDate,
        // 총처방기간
        eat: eatDays,
        // 제품 이름
        product: productNames,
        // 제품 가격
        p_price: productPrices,
        // 제품수
        p_quantity: productQuantities
      };

      ipcRenderer.send('start-playwright', data);
    });

    button_delegation.addEventListener('click', () => {
      const patientName = document.querySelector('#patientName').value;
      const patientSSN = document.querySelector('#patientSocialSecurityNumber').value;
      const issueDate = document.querySelector("#prescriptionDate").value;
      const phonenumber = document.querySelector("#patientPhoneNumber").value;
      const selectElement = document.querySelector('#diabetesPatientBenefitTypeCd');
      const selectedText = selectElement.options[selectElement.selectedIndex].textContent;
      const enddate = document.querySelector("#delegationEndDate").value;

      const data_1 = {
        // 환자이름
        name: patientName,
        // 주민번호
        ssn: patientSSN,
        // 처방일자
        issue: issueDate,
        // 전화번호
        phone: phonenumber,
        // 당뇨 유형 | 투여 여부 | 기타
        select: selectedText,
        // 위임 종료일
        end: enddate
      }

      ipcRenderer.send('start', data_1);
    });
  }
});