const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  send: (channel, data) => ipcRenderer.send(channel, data),
  receive: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
});

window.addEventListener("DOMContentLoaded", () => {
  const url = window.location.href;

  // csrfToken, csrfHeader,
  const csrfToken = document.querySelector("meta[name='_csrf']").content;
  const csrfHeader = document.querySelector("meta[name='_csrf_header']").content;
  /*const pharmacyBizNo = document.querySelector("#pharmacyBizNo").value;*/

  const data_0 = {
                        csrfHeader : csrfHeader,
                        csrfToken : csrfToken,
                        pharmacyBizNo: "",
                      };

  const button_delegation_history = document.querySelector("#autoDelegationHistory"); //id="autoDelegationHistory"
  if (!isEmpty(button_delegation_history)) {
    button_delegation_history.addEventListener('click', () => {
      console.log("Delegation History clicked");
      ipcRenderer.send('start-check-delegation', data_0);
    });

  } else {
    console.info('Delegation History button is not found.');
  }

  let button_billing_history = document.querySelector("#autoBillingHistory"); //id="autoBillingHistory"
  if (!isEmpty(button_billing_history)) {
    button_billing_history.addEventListener('click', () => {
      console.info("Billing History clicked");
      ipcRenderer.send('start-check-bill', data_0);
    });

  } else {
    console.info('Billing History button is not found.');
  }

  // 계산기 > 계산목록 전자 세금계산서 자동 발행 시작 button 클릭
  if (url.includes("/pharm/diabetes/calc-list-view") || url.includes("/pharm/diabetes/calc-list")) {
    const autoTaxInvoiceBillBtnEl = document.querySelector("#autoTaxInvoiceBillBtn"); //id="autoTaxInvoiceBillBtn"
    autoTaxInvoiceBillBtnEl.innerText = "세금계산서 자동청구 시작";

    let button_billing_history = document.querySelector("#autoBillingHistory"); //id="autoBillingHistory"
    if (!isEmpty(button_billing_history)) {
      button_billing_history.addEventListener('click', () => {
        console.info("Billing History clicked");
        const csrfToken = document.querySelector("meta[name='_csrf']").content;
        const csrfHeader = document.querySelector(
            "meta[name='_csrf_header']"
        ).content;
        const autoTaxInvoiceFile = document.querySelector(
            "#autoTaxInvoiceFile"
        ).value;
        const taxInvoiceData = {
          ...data_0,
          // 전자세금계산서 엑셀파일
          homeTaxInvoiceFile: autoTaxInvoiceFile,
          // API 연결을 위한 token
          csrfToken: csrfToken,
          csrfHeader: csrfHeader,
        };
        ipcRenderer.send('start-check-bill', taxInvoiceData);
      });

    } else {
      console.info('Billing History button is not found.');
    }
  }

  // 계산기 > 계산목록 조회
  if (
      url.includes("/pharm/diabetes/calc-list-view") ||
      url.includes("/pharm/diabetes/calc-list")
  ) {
    // 전자세금계산서 신고등록
    let button_hometax_billing = document.querySelector("#autoTaxInvoiceBillBtn");
    if (!isEmpty(button_hometax_billing)) {
        button_hometax_billing.addEventListener('click', () => {
          /* 2024.12.18
           홈택스 신고자료 파일명 설정
         */
          const hometaxFileName = document
              .querySelector("#hometaxFileName")
              .value.replace(" ", "_");

          /* 2024.12.18
             홈택스 신고자료 파일명 signed url 설정
           */
          const hometaxFileSignedUrl = document
              .querySelector("#hometaxFileSignedUrl")
              .value.replace(" ", "_");
          /* 2024.12.18
             홈택스 파일명이 존재하는 경우
           */
          const isHometaxFileExist = !isEmpty(hometaxFileName) && isEmpty(hometaxFileSignedUrl);

          const autoTaxData = {
            ...data_0,
            hometaxFileSignedUrl,
            hometaxFileName,
            isHometaxFileExist: isHometaxFileExist,
          };

          console.info("autoTaxInvoiceBillBtn clicked");
          ipcRenderer.send('start-hometax', autoTaxData);
        });
    } else {
      console.info('"autoTaxInvoiceBillBtn" button is not found.');
    }

  }

  // 계산기 > 데이터 수정하기 calc-update ,  계산목록 > 환자 한명 선택하면 calc-detail
  if (
    url.includes("/pharm/diabetes/calc-update") ||
    url.includes("/pharm/diabetes/calc-detail")
  ) {
    const button_bill = document.querySelector("#autoBillBtn"); //id="autoBillBtn"
    button_bill.innerText = "자동 청구 시작";

    //const button_delegation = document.querySelector("#delegationBtn");
    const button_delegation = document.querySelector("#autoDelegationBtn");
    button_delegation.innerText = "위임 등록하기";

    // Add click event listener to the button
    /* Start [요양비 청구하기] */
    button_bill.addEventListener("click", () => {
      const csrfToken = document.querySelector("meta[name='_csrf']").content;
      const csrfHeader = document.querySelector(
        "meta[name='_csrf_header']"
      ).content;

      const pharmacyPatientDiabetesTreatId = document.querySelector(
        "#pharmacyPatientDiabetesTreatId"
      ).value;
      const pharmacyBizNo = document.querySelector(
          "#pharmacyBizNo"
      ).value;
      const patientName = document.querySelector("#patientName").value;
      const patientSSN = document.querySelector(
        "#patientSocialSecurityNumber"
      ).value;
      const issueDate = document.querySelector("#prescriptionDate").value;
      const selectElement = document.querySelector(
        "#diabetesPatientBenefitTypeCd"
      );
      const selectedText =
        selectElement.options[selectElement.selectedIndex].textContent;
      const hospitalCareOrgNo = document.querySelector("#hospitalCareOrgNo").value;
      const doctorNumber = document.querySelector("#doctorLicenseNo").value;
      // const qualificationNo = document.querySelector("#qualificationNo").value;
      const bloodNumber = document.querySelector(
        "#bloodGlucoseTestNumber"
      ).value;
      const insulinNumber = document.querySelector(
        "#insulinInjectionNumber"
      ).value;
      const diseaseCode = document.querySelector("#diseaseCodeName").value.replace('.', '').replace(',', '').replace('-', '').replace('_', '').replace(' ', '');
      const purchaseDate = document.querySelector("#purchaseDate").value;
      const eatDays = document.querySelector("#eatDays").value;
      const productNames = Array.from(
        document.querySelectorAll(
          "td.align-middle.ellipsis-w-100 span.pm-normal-text"
        )
      ).map((span) => span.textContent.trim());
      const productPrices = [];
      const productQuantities = [];
      let i = 0;
      while (true) {
        const prices = Array.from(
          document.querySelectorAll(
            `#diabetesSuppliesResDtoList${i}\\.totalPrice`
          )
        ).map((element) => element.value);
        const quantities = Array.from(
          document.querySelectorAll(
            `#diabetesSuppliesResDtoList${i}\\.quantity`
          )
        ).map((element) => element.value);
        productPrices.push(...prices);
        productQuantities.push(...quantities);
        if (prices.length === 0 && quantities.length === 0) {
          break;
        }
        i++;
      }
      // 구매영수증 파일
      const paymentReceiptFileName = document
        .querySelector("#paymentReceiptFileName")
        .value.replace(" ", "+"); // 다운로드를 위해 빈칸=>+ 로 replace
      const paymentReceiptSignedUrl = document.querySelector(
        "#paymentReceiptSignedUrl"
      ).value;

      // 연속혈당측정용 전극 고유식별번호 파일
      const isCgmSensor =
        document.querySelector("#CGM_SENSOR").value === "true";
      const cgmSeqNoFileName = document
        .querySelector("#cgmSeqNoFileName")
        .value.replace(" ", "+"); // 다운로드를 위해 빈칸=>+ 로 replace
      const cgmSeqNoSignedUrl =
        document.querySelector("#cgmSeqNoSignedUrl").value;

      // 위임장 파일
      const paymentClaimDelegationFileName = document
        .querySelector("#paymentClaimDelegationFileName")
        .value.replace(" ", "+"); // 다운로드를 위해 빈칸=>+ 로 replace
      const paymentClaimDelegationSignedUrl = document.querySelector(
        "#paymentClaimDelegationSignedUrl"
      ).value;

      // 처방전 파일
      const prescriptionFileName = document
        .querySelector("#prescriptionFileName")
        .value.replace(" ", "+"); // 다운로드를 위해 빈칸=>+ 로 replace
      const prescriptionSignedUrl = document.querySelector(
        "#prescriptionSignedUrl"
      ).value;

      // 출력문서 파일
      const diabetesDocFileName = document
        .querySelector("#diabetesDocFileName")
        .value.replace(" ", "+"); // 다운로드를 위해 빈칸=>+ 로 replace
      const diabetesDocSignedUrl = document.querySelector(
        "#diabetesDocSignedUrl"
      ).value;

      // 1형 당뇨때 추가될 내용들
      const cgmStartDate = document.querySelector("#cgmStartDate").value;
      const cgmEndDate = document.querySelector("#cgmEndDate").value;
      const cgmWearDays = document.querySelector("#cgmWearDays").value;
      const cgmWearPercent = document.querySelector("#cgmWearPercent").value;
      const cgmAvgBloodGlucose = document.querySelector("#cgmAvgBloodGlucose").value;
      const cgmCovBloodGlucosePercent = document.querySelector("#cgmCovBloodGlucosePercent").value;
      const cgmCovBloodGlucoseMgdl = document.querySelector("#cgmCovBloodGlucoseMgdl").value;
      const cgmGlycatedHemoglobinDate = document.querySelector("#cgmGlycatedHemoglobinDate").value;
      const cgmGlycatedHemoglobinPercent = document.querySelector("#cgmGlycatedHemoglobinPercent").value;
      const cgmSeqNoList = document.querySelector("#cgmSeqNoList");

      const data = {
        // 당뇨진료이력 Id
        docId: pharmacyPatientDiabetesTreatId,
        // 약국 사업자등록번호
        pharmacyBizNo: pharmacyBizNo,
        // 환자이름
        name: patientName,
        // 주민번호
        ssn: patientSSN,
        // 처방일자
        issue: issueDate,
        // 당뇨 유형 | 투여 여부 | 기타
        select: selectedText,
        // 요양기관 번호
        hospitalCareOrgNo: hospitalCareOrgNo,
        // 의사면허 번호
        doctor: doctorNumber,
        // 전문의 번호
        // qualificationNo: qualificationNo,
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
        p_quantity: productQuantities,
        // 구매영수증 파일
        paymentReceiptFileName: paymentReceiptFileName,
        paymentReceiptSignedUrl: paymentReceiptSignedUrl,
        // 연속혈당측정용 전극 고유식별번호 파일
        isCgmSensor: isCgmSensor,
        cgmSeqNoFileName: cgmSeqNoFileName,
        cgmSeqNoSignedUrl: cgmSeqNoSignedUrl,
        // 위임장 파일
        paymentClaimDelegationFileName: paymentClaimDelegationFileName,
        paymentClaimDelegationSignedUrl: paymentClaimDelegationSignedUrl,
        // 처방전 파일
        prescriptionFileName: prescriptionFileName,
        prescriptionSignedUrl: prescriptionSignedUrl,
        // 출력문서 파일
        diabetesDocFileName: diabetesDocFileName,
        diabetesDocSignedUrl: diabetesDocSignedUrl,
        // API 연결을 위한 token
        csrfToken: csrfToken,
        csrfHeader: csrfHeader,
        // 1형 당뇨 추가되어야 할 내용
        cgmStartDate: cgmStartDate,
        cgmEndDate: cgmEndDate,
        cgmWearDays: cgmWearDays,
        cgmWearPercent:cgmWearPercent,
        cgmAvgBloodGlucose:cgmAvgBloodGlucose,
        cgmCovBloodGlucosePercent:cgmCovBloodGlucosePercent,
        cgmCovBloodGlucoseMgdl: cgmCovBloodGlucoseMgdl,
        cgmGlycatedHemoglobinDate:cgmGlycatedHemoglobinDate,
        cgmGlycatedHemoglobinPercent:cgmGlycatedHemoglobinPercent,
        cgmSeqNoList:cgmSeqNoList,

      };

      ipcRenderer.send("start-playwright", data);
    });
    /* End [요양비 청구하기] */
    /* Start [위임 등록하기] */
    button_delegation.addEventListener("click", () => {
      const patientName = document.querySelector("#patientName").value;
      const patientSSN = document.querySelector(
        "#patientSocialSecurityNumber"
      ).value;
      // 대리인 정보
      const isSelfClaim = document.querySelector("#isSelfClaim").value;
      const deputyName = document.querySelector("#deputyName").value;
      const deputyBirthDateAbbr = document.querySelector("#deputyBirthDateAbbr").value;
      const deputyRelationshipIndex = document.querySelector("#deputyRelationshipIndex").value;
      const deputyRelationshipName = document.querySelector("#deputyRelationshipName").value;
      const receivePhoneNo = document.querySelector("#receivePhoneNo").value;

      const issueDate = document.querySelector("#prescriptionDate").value;
      const phonenumber = document.querySelector("#patientPhoneNumber").value;
      const selectElement = document.querySelector(
        "#diabetesPatientBenefitTypeCd"
      );
      const selectedText =
        selectElement.options[selectElement.selectedIndex].textContent;
      // 구매일
      let startDate = new Date(document.querySelector("#purchaseDate").value);
      let endDate = new Date(startDate);
      // 5년 후
      endDate.setFullYear(endDate.getFullYear() + 5);
      // 1일 전으로 설정
      endDate.setDate(endDate.getDate() - 1);

      startDate = formatDate(startDate);
      endDate = formatDate(endDate);

      // 구매영수증 파일
      const paymentReceiptFileName = document
        .querySelector("#paymentReceiptFileName")
        .value.replace(" ", "+"); // 다운로드를 위해 빈칸=>+ 로 replace
      const paymentReceiptSignedUrl = document.querySelector(
        "#paymentReceiptSignedUrl"
      ).value;

      // 연속혈당측정용 전극 고유식별번호 파일
      const isCgmSensor =
        document.querySelector("#CGM_SENSOR").value === "true";
      const cgmSeqNoFileName = document
        .querySelector("#cgmSeqNoFileName")
        .value.replace(" ", "+"); // 다운로드를 위해 빈칸=>+ 로 replace
      const cgmSeqNoSignedUrl =
        document.querySelector("#cgmSeqNoSignedUrl").value;

      // 위임장 파일
      const paymentClaimDelegationFileName = document
        .querySelector("#paymentClaimDelegationFileName")
        .value.replace(" ", "+"); // 다운로드를 위해 빈칸=>+ 로 replace
      const paymentClaimDelegationSignedUrl = document.querySelector(
        "#paymentClaimDelegationSignedUrl"
      ).value;

      // 신분증


      const idCardFileName = document
        .querySelector("#idCardFileName")
        .value.replace(" ","+");
      const idCardSignedUrl = document
        .querySelector("#idCardSignedUrl")
        .value.replace(" ","+");


      // 처방전 파일
      const prescriptionFileName = document
        .querySelector("#prescriptionFileName")
        .value.replace(" ", "+"); // 다운로드를 위해 빈칸=>+ 로 replace
      const prescriptionSignedUrl = document.querySelector(
        "#prescriptionSignedUrl"
      ).value;

      // 출력문서 파일
      const diabetesDocFileName = document
        .querySelector("#diabetesDocFileName")
        .value.replace(" ", "+"); // 다운로드를 위해 빈칸=>+ 로 replace
      const diabetesDocSignedUrl = document.querySelector(
        "#diabetesDocSignedUrl"
      ).value;

      const data_1 = {
        // 환자이름
        name: patientName,
        // 주민번호
        ssn: patientSSN,
        // 본인청구 여부
        isSelfClaim: isSelfClaim,
        // 대리인 성명
        deputyName: deputyName,
        // 대리인 생년월일
        deputyBirthDateAbbr: deputyBirthDateAbbr,
        // 가입자 피부양자와의 관계 index
        deputyRelationshipIndex: deputyRelationshipIndex,
        // 가입자 피부양자와의 관계
        deputyRelationshipName: deputyRelationshipName,
        // 수신용 휴대전화번호
        receivePhoneNo: receivePhoneNo,
        // 처방일자
        issue: issueDate,
        // 전화번호
        phone: phonenumber,
        // 당뇨 유형 | 투여 여부 | 기타
        select: selectedText,
        // 위임 시작일(동의일)
        start: startDate,
        // 위임 종료일
        end: endDate,
        // 구매영수증 파일
        paymentReceiptFileName: paymentReceiptFileName,
        paymentReceiptSignedUrl: paymentReceiptSignedUrl,
        // 연속혈당측정용 전극 고유식별번호 파일
        isCgmSensor: isCgmSensor,
        cgmSeqNoFileName: cgmSeqNoFileName,
        cgmSeqNoSignedUrl: cgmSeqNoSignedUrl,
        // 위임장 파일
        paymentClaimDelegationFileName: paymentClaimDelegationFileName,
        paymentClaimDelegationSignedUrl: paymentClaimDelegationSignedUrl,

        idCardFileName: idCardFileName,
        idCardSignedUrl: idCardSignedUrl,
        // 처방전 파일
        prescriptionFileName: prescriptionFileName,
        prescriptionSignedUrl: prescriptionSignedUrl,
        // 출력문서 파일
        diabetesDocFileName: diabetesDocFileName,
        diabetesDocSignedUrl: diabetesDocSignedUrl,
      };

      ipcRenderer.send("start", data_1);
    });
    /* End [위임 등록하기] */

  }

});

/**
 * date -> str (yyyy.mm.dd)
 * @param date
 * @returns {string}
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // 월은 0부터 시작하므로 1을 더해줍니다.
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}`;
}

/**
 * 빈값 체크
 * @param value 체크하려는 값
 * @returns {boolean}
 */
function isEmpty(value) {
  if (typeof value === "undefined" || value === null || value === "" || value === "null") {
    return Boolean(true);
  } else {
    return Boolean(false);
  }
}