const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  send: (channel, data) => ipcRenderer.send(channel, data),
  send: (channel, data_1) => ipcRenderer.send(channel, data_1),
  receive: (channel, func) =>
    ipcRenderer.on(channel, (event, ...args) => func(...args)),
});

window.addEventListener("DOMContentLoaded", () => {
  const url = window.location.href;

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
      const hospitalNumber = document.querySelector("#hospitalCareOrgNo").value;
      const doctorNumber = document.querySelector("#doctorLicenseNo").value;
      // const departmentName = document.querySelector("#").value;
      const bloodNumber = document.querySelector(
        "#bloodGlucoseTestNumber"
      ).value;
      const insulinNumber = document.querySelector(
        "#insulinInjectionNumber"
      ).value;
      const diseaseCode = document.querySelector("#diseaseCodeName").value;
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
      };

      ipcRenderer.send("start-playwright", data);
    });

    button_delegation.addEventListener("click", () => {
      const patientName = document.querySelector("#patientName").value;
      const patientSSN = document.querySelector(
        "#patientSocialSecurityNumber"
      ).value;
      // 대리인 정보
      const isSelfClaim = document.querySelector("#isSelfClaim").value;
      const deputyName = document.querySelector("#deputyName").value;
      const deputyBirthDateAbbr = document.querySelector("#deputyBirthDateAbbr").value;
      const deputyRelationshipName = document.querySelector("#deputyRelationshipName").value;
      const receivePhoneNo = document.querySelector("#receivePhoneNo").value;

      const issueDate = document.querySelector("#prescriptionDate").value;
      const phonenumber = document.querySelector("#patientPhoneNumber").value;
      const selectElement = document.querySelector(
        "#diabetesPatientBenefitTypeCd"
      );
      const selectedText =
        selectElement.options[selectElement.selectedIndex].textContent;
      const enddate = document.querySelector("#delegationEndDate").value;
      const startdate = document.querySelector("#delegationStartDate").value;

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
        start: startdate,
        // 위임 종료일
        end: enddate,
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
  } else if (
    url.includes("/pharm/diabetes/delegation-list") ||
    url.includes("/pharm/diabetes/nhis-delegation-list")
  ) {
    const url = window.location.href;

    /*const button = document.querySelector("#nhisBtn"); 

    button_bill.addEventListener("click", () => {
      const csrfToken = document.querySelector("meta[name='_csrf']").content;
      const csrfHeader = document.querySelector(
        "meta[name='_csrf_header']"
      ).content;

      console.log("test start!");

      ipcRenderer.send("start-crawl-delegation");
    });*/

    const buttonToBack = document.querySelector("#nhisBtn");

    buttonToBack.addEventListener("click", () => {
      const csrfToken = document.querySelector("meta[name='_csrf']").content;
      const csrfHeader = document.querySelector(
        "meta[name='_csrf_header']"
      ).content;

      console.log("test start 123!");

      ipcRenderer.send("start-crawl-delegation");
    });
  }
});