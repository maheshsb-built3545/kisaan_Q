/**
 * Multi-lingual notification templates (English, Hindi, Marathi)
 */

const TEMPLATES = {
  booking_confirmed: {
    en: (p) => ({
      title: 'Slot Booking Confirmed',
      body: `Your slot for Token #${p.tokenNumber || ''} (${p.crop || 'Crop'}) is confirmed at APMC ${p.mandiName || ''} for ${p.slotTime || p.slotDate || ''}.`
    }),
    hi: (p) => ({
      title: 'स्लॉट बुकिंग पुष्ट',
      body: `टोकन #${p.tokenNumber || ''} (${p.crop || 'फसल'}) के लिए आपका स्लॉट APMC ${p.mandiName || ''} में ${p.slotTime || p.slotDate || ''} हेतु पुष्ट हो गया है।`
    }),
    mr: (p) => ({
      title: 'स्लॉट बुकिंग निश्चित झाली',
      body: `टोकन #${p.tokenNumber || ''} (${p.crop || 'पीक'}) साठी आपला स्लॉट APMC ${p.mandiName || ''} येथे ${p.slotTime || p.slotDate || ''} साठी निश्चित झाला आहे.`
    })
  },

  booking_cancelled: {
    en: (p) => ({
      title: 'Booking Cancelled',
      body: `Token #${p.tokenNumber || ''} at APMC ${p.mandiName || ''} has been cancelled. Reason: ${p.reason || 'Farmer request'}.`
    }),
    hi: (p) => ({
      title: 'बुकिंग रद्द',
      body: `APMC ${p.mandiName || ''} का टोकन #${p.tokenNumber || ''} रद्द कर दिया गया है। कारण: ${p.reason || 'किसान अनुरोध'}।`
    }),
    mr: (p) => ({
      title: 'बुकिंग रद्द केली',
      body: `APMC ${p.mandiName || ''} येथील टोकन #${p.tokenNumber || ''} रद्द केले गेले आहे. कारण: ${p.reason || 'शेतकरी विनंती'}.`
    })
  },

  gate_checkin: {
    en: (p) => ({
      title: 'Gate Check-In Verified',
      body: `Token #${p.tokenNumber || ''} checked in at Gate #1. Please proceed to Quality Assay Bay.`
    }),
    hi: (p) => ({
      title: 'गेट चेक-इन सत्यापित',
      body: `टोकन #${p.tokenNumber || ''} गेट #1 पर चेक-इन हो गया है। कृपया गुणवत्ता जांच बे की ओर बढ़ें।`
    }),
    mr: (p) => ({
      title: 'गेट चेक-इन तपासणी पूर्ण',
      body: `टोकन #${p.tokenNumber || ''} चे गेट #१ वर चेक-इन झाले. कृपया गुणवत्ता तपासणी कक्षाकडे जा.`
    })
  },

  quality_assayed: {
    en: (p) => ({
      title: 'Quality Assaying Done',
      body: `Token #${p.tokenNumber || ''} grade: ${p.grade || 'Grade A'} (Moisture: ${p.moisture || '12'}%). Proceed to Weighbridge.`
    }),
    hi: (p) => ({
      title: 'गुणवत्ता जांच संपन्न',
      body: `टोकन #${p.tokenNumber || ''} श्रेणी: ${p.grade || 'Grade A'} (नमी: ${p.moisture || '12'}%)। वेईब्रिज की ओर बढ़ें।`
    }),
    mr: (p) => ({
      title: 'गुणवत्ता तपासणी पूर्ण',
      body: `टोकन #${p.tokenNumber || ''} प्रत: ${p.grade || 'Grade A'} (आर्द्रता: ${p.moisture || '12'}%). वजन काट्याकडे जा.`
    })
  },

  weighbridge_done: {
    en: (p) => ({
      title: 'Weighbridge Recorded',
      body: `Token #${p.tokenNumber || ''} weight captured: Net ${p.netWeight || p.quantity || ''} Qtl. Proceed to Procurement Desk.`
    }),
    hi: (p) => ({
      title: 'वजन दर्ज किया गया',
      body: `टोकन #${p.tokenNumber || ''} कुल वजन दर्ज: ${p.netWeight || p.quantity || ''} क्विंटल। खरीद डेस्क पर जाएं।`
    }),
    mr: (p) => ({
      title: 'वजन नोंदवले गेले',
      body: `टोकन #${p.tokenNumber || ''} निव्वळ वजन: ${p.netWeight || p.quantity || ''} क्विंटल. खरेदी कक्षाकडे जा.`
    })
  },

  procurement_recorded: {
    en: (p) => ({
      title: 'Procurement Slip Issued',
      body: `Token #${p.tokenNumber || ''} purchase deed registered. Total statutory payable: ₹${p.totalAmount || ''}.`
    }),
    hi: (p) => ({
      title: 'खरीद पर्ची जारी',
      body: `टोकन #${p.tokenNumber || ''} खरीद रसीद दर्ज। कुल देय राशि: ₹${p.totalAmount || ''}।`
    }),
    mr: (p) => ({
      title: 'खरेदी पावती जारी',
      body: `टोकन #${p.tokenNumber || ''} खरेदी नोंदणीकृत. एकूण देय रक्कम: ₹${p.totalAmount || ''}.`
    })
  },

  payout_ready: {
    en: (p) => ({
      title: 'Procurement Complete — Payout Ready',
      body: `Procurement verified for Token #${p.tokenNumber || ''}. Statutory payable ₹${p.amount || p.totalAmount || ''} queued for Treasury DBT transfer.`
    }),
    hi: (p) => ({
      title: 'खरीद पूर्ण — भुगतान तैयार',
      body: `टोकन #${p.tokenNumber || ''} की खरीद सत्यापित। ₹${p.amount || p.totalAmount || ''} का भुगतान DBT अंतरण हेतु कतार में है।`
    }),
    mr: (p) => ({
      title: 'खरेदी पूर्ण — देयक तयार',
      body: `टोकन #${p.tokenNumber || ''} ची खरेदी पूर्ण झाली. देय रक्कम ₹${p.amount || p.totalAmount || ''} DBT बँक वर्गणीसाठी तयार आहे.`
    })
  },

  payout_paid: {
    en: (p) => ({
      title: 'DBT Payout Dispatched',
      body: `Net payout ₹${p.netPaid || p.amount || ''} for Token #${p.tokenNumber || ''} successfully dispatched to your bank account via PFMS DBT.`
    }),
    hi: (p) => ({
      title: 'DBT भुगतान बैंक में प्रेषित',
      body: `टोकन #${p.tokenNumber || ''} हेतु शुद्ध राशि ₹${p.netPaid || p.amount || ''} PFMS DBT द्वारा आपके बैंक खाते में भेज दी गई है।`
    }),
    mr: (p) => ({
      title: 'DBT रक्कम बँक खात्यात वर्ग',
      body: `टोकन #${p.tokenNumber || ''} साठी निव्वळ रक्कम ₹${p.netPaid || p.amount || ''} PFMS DBT द्वारे आपल्या बँक खात्यात वर्ग करण्यात आली.`
    })
  },

  payout_settled: {
    en: (p) => ({
      title: 'DBT Payout Dispatched',
      body: `Net payout ₹${p.netPaid || p.amount || ''} for Token #${p.tokenNumber || ''} initiated via Direct Bank Transfer.`
    }),
    hi: (p) => ({
      title: 'DBT भुगतान जारी',
      body: `टोकन #${p.tokenNumber || ''} हेतु ₹${p.netPaid || p.amount || ''} का भुगतान प्रत्यक्ष बैंक अंतरण (DBT) द्वारा भेजा गया।`
    }),
    mr: (p) => ({
      title: 'DBT बँक खात्यात जमा',
      body: `टोकन #${p.tokenNumber || ''} साठी ₹${p.netPaid || p.amount || ''} थेट बँक खात्यात (DBT) वर्ग करण्यात आले.`
    })
  },

  leave_by_alert: {
    en: (p) => ({
      title: 'Leave-By Alert',
      body: `Recommended departure: Please leave by ${p.leaveTime || 'now'} for APMC ${p.mandiName || ''} (Transit: ${p.travelTimeMins || '20'}m).`
    }),
    hi: (p) => ({
      title: 'प्रस्थान समय चेतावनी',
      body: `अनुशंसित प्रस्थान समय: कृपया APMC ${p.mandiName || ''} के लिए ${p.leaveTime || 'अभी'} निकलें (यात्रा: ${p.travelTimeMins || '20'} मिनट)।`
    }),
    mr: (p) => ({
      title: 'निघण्याची वेळ सूचना',
      body: `कृपया APMC ${p.mandiName || ''} साठी ${p.leaveTime || 'आत्ता'} निघा (प्रवास वेळ: ${p.travelTimeMins || '20'} मिनिटे).`
    })
  },

  turn_near: {
    en: (p) => ({
      title: 'Your Turn Is Near',
      body: `Token #${p.tokenNumber || ''} is now at Position ${p.position || p.queuePosition || '3'} in queue. Please stay close to gate.`
    }),
    hi: (p) => ({
      title: 'आपकी बारी निकट है',
      body: `टोकन #${p.tokenNumber || ''} अब कतार में स्थान ${p.position || p.queuePosition || '3'} पर है। कृपया गेट के पास रहें।`
    }),
    mr: (p) => ({
      title: 'आपला नंबर जवळ आला आहे',
      body: `टोकन #${p.tokenNumber || ''} आता रांगेत ${p.position || p.queuePosition || '३'} क्रमांकावर आहे. कृपया गेटजवळ उपस्थित राहा.`
    })
  },

  slot_warning: {
    en: (p) => ({
      title: 'Arrival Window Warning',
      body: `Your slot for Token #${p.tokenNumber || ''} started 5 mins ago. Please check in within 5 mins to avoid forfeiture.`
    }),
    hi: (p) => ({
      title: 'स्लॉट समय चेतावनी',
      body: `टोकन #${p.tokenNumber || ''} का स्लॉट 5 मिनट पहले शुरू हुआ। रद्दीकरण से बचने हेतु 5 मिनट में चेक-इन करें।`
    }),
    mr: (p) => ({
      title: 'स्लॉट वेळ इशारा',
      body: `टोकन #${p.tokenNumber || ''} ची वेळ ५ मिनिटांपूर्वी सुरू झाली. स्लॉट रद्द होऊ नये म्हणून पुढील ५ मिनिटांत हजर राहा.`
    })
  },

  slot_released: {
    en: (p) => ({
      title: 'Slot Auto-Released',
      body: `Token #${p.tokenNumber || ''} has been released due to grace period expiry (No-show after 10 mins).`
    }),
    hi: (p) => ({
      title: 'स्लॉट स्वतः जारी/रद्द',
      body: `10 मिनट अनुग्रह अवधि समाप्त होने के कारण टोकन #${p.tokenNumber || ''} का स्लॉट रद्द/मुक्त कर दिया गया है।`
    }),
    mr: (p) => ({
      title: 'स्लॉट रद्द / मोकळा झाला',
      body: `१० मिनिटांची मुदत संपल्याने टोकन #${p.tokenNumber || ''} चा स्लॉट रद्द करण्यात आला आहे.`
    })
  },

  slot_gone: {
    en: (p) => ({
      title: 'Slot Reallocated',
      body: `Your missed slot #${p.tokenNumber || ''} was reallocated to a waiting farmer.`
    }),
    hi: (p) => ({
      title: 'स्लॉट पुनः आवंटित',
      body: `आपका छूटा हुआ स्लॉट #${p.tokenNumber || ''} प्रतीक्षा सूची के किसान को दे दिया गया है।`
    }),
    mr: (p) => ({
      title: 'स्लॉट इतर शेतकऱ्यास दिला',
      body: `आपला वेळ संपलेला स्लॉट #${p.tokenNumber || ''} प्रतीक्षा यादीतील शेतकऱ्याला देण्यात आला आहे.`
    })
  },

  waitlist_offer: {
    en: (p) => ({
      title: 'Slot Vacancy Offer',
      body: `A slot opened at APMC ${p.mandiName || ''} for ${p.slotTime || 'today'}. You have 10 mins to accept!`
    }),
    hi: (p) => ({
      title: 'स्लॉट रिक्ति प्रस्ताव',
      body: `APMC ${p.mandiName || ''} में ${p.slotTime || 'आज'} के लिए स्लॉट खाली हुआ है। स्वीकारने हेतु 10 मिनट हैं!`
    }),
    mr: (p) => ({
      title: 'स्लॉट उपलब्धता संधी',
      body: `APMC ${p.mandiName || ''} येथे ${p.slotTime || 'आज'} साठी स्लॉट उपलब्ध झाला आहे. स्वीकारण्यासाठी १० मिनिटे आहेत!`
    })
  },

  slot_arrival_warning: {
    en: (p) => ({
      title: 'Arrival Grace Window Active',
      body: `Slot #${p.tokenNumber || ''} arrival window started. ${p.graceMinutesRemaining || 5} mins remaining to check in at Gate.`
    }),
    hi: (p) => ({
      title: 'आगमन अनुग्रह समय सक्रिय',
      body: `स्लॉट #${p.tokenNumber || ''} का आगमन समय शुरू हुआ। गेट चेक-इन हेतु ${p.graceMinutesRemaining || 5} मिनट शेष हैं।`
    }),
    mr: (p) => ({
      title: 'आगमन सवलत वेळ सुरू',
      body: `स्लॉट #${p.tokenNumber || ''} चा आगमन कालावधी सुरू झाला आहे. गेट चेक-इनसाठी ${p.graceMinutesRemaining || 5} मिनिटे शिल्लक आहेत.`
    })
  },

  slot_auto_released: {
    en: (p) => ({
      title: 'Slot Released Due to Non-Arrival',
      body: `Booking #${p.tokenNumber || ''} was automatically released after grace period expired.`
    }),
    hi: (p) => ({
      title: 'अनुपस्थिति के कारण स्लॉट निरस्त',
      body: `अनुग्रह समय समाप्त होने पर बुकिंग #${p.tokenNumber || ''} स्वतः निरस्त व पुनः आवंटित कर दी गई।`
    }),
    mr: (p) => ({
      title: 'वेळेत हजर न राहिल्याने स्लॉट रद्द',
      body: `सवलत वेळ संपल्यामुळे बुकिंग #${p.tokenNumber || ''} आपोआप रद्द करून इतर शेतकऱ्यास उपलब्ध करण्यात आली.`
    })
  },

  slot_offer_available: {
    en: (p) => ({
      title: 'Slot Vacancy Offer Available',
      body: `A slot for ${p.crop || 'crop'} (${p.quantity || ''} Qtl) is available at APMC ${p.mandiName || ''}. You have 10 mins to accept!`
    }),
    hi: (p) => ({
      title: 'स्लॉट रिक्ति प्रस्ताव उपलब्ध',
      body: `APMC ${p.mandiName || ''} में ${p.crop || 'फसल'} के लिए स्लॉट उपलब्ध है। स्वीकारने हेतु 10 मिनट शेष हैं!`
    }),
    mr: (p) => ({
      title: 'नवीन स्लॉट संधी उपलब्ध',
      body: `APMC ${p.mandiName || ''} येथे ${p.crop || 'पिकासाठी'} स्लॉट उपलब्ध झाला आहे. स्वीकारण्यासाठी १० मिनिटे आहेत!`
    })
  },

  slot_offer_confirmed: {
    en: (p) => ({
      title: 'Waitlist Slot Confirmed',
      body: `Your slot at APMC ${p.mandiName || ''} is confirmed! Token #${p.tokenNumber || ''}.`
    }),
    hi: (p) => ({
      title: 'प्रतीक्षा सूची स्लॉट पुष्टीकृत',
      body: `APMC ${p.mandiName || ''} में आपका स्लॉट पुष्टीकृत हो गया है! टोकन #${p.tokenNumber || ''}.`
    }),
    mr: (p) => ({
      title: 'प्रतीक्षा यादी स्लॉट निश्चित',
      body: `APMC ${p.mandiName || ''} मधील आपला स्लॉट निश्चित झाला आहे! टोकन क्रमांक: #${p.tokenNumber || ''}.`
    })
  },

  fast_track_won: {
    en: (p) => ({
      title: 'Fast-Track Round Won (Awaiting Approval)',
      body: `You placed the winning bid of ₹${p.amount || ''} for Token #${p.tokenNumber || ''}. Sent to Planning Officer for approval.`
    }),
    hi: (p) => ({
      title: 'फास्ट-ट्रैक बोली जीती (स्वीकृति प्रतीक्षित)',
      body: `टोकन #${p.tokenNumber || ''} हेतु आपकी ₹${p.amount || ''} की बोली जीती। अधिकारी स्वीकृति हेतु प्रेषित।`
    }),
    mr: (p) => ({
      title: 'फास्ट-ट्रॅक फेरी जिंकली (मंजुरी प्रलंबित)',
      body: `टोकन #${p.tokenNumber || ''} साठी आपली ₹${p.amount || ''} ची बोली जिंकली. नियोजन अधिकाऱ्याच्या मंजुरीसाठी पाठवले.`
    })
  },

  fast_track_approved: {
    en: (p) => ({
      title: 'Fast-Track Priority Approved',
      body: `Planning Officer approved Fast-Track for Token #${p.tokenNumber || ''}. Your queue position moved ahead!`
    }),
    hi: (p) => ({
      title: 'फास्ट-ट्रैक प्राथमिकता स्वीकृत',
      body: `अधिकारी ने टोकन #${p.tokenNumber || ''} की फास्ट-ट्रैक प्राथमिकता स्वीकृत की। आपका कतार स्थान आगे बढ़ गया!`
    }),
    mr: (p) => ({
      title: 'फास्ट-ट्रॅक प्राधान्य मंजूर',
      body: `अधिकाऱ्यांनी टोकन #${p.tokenNumber || ''} चे फास्ट-ट्रॅक मंजूर केले. आपला रांगेतील नंबर पुढे गेला!`
    })
  },

  fast_track_declined: {
    en: (p) => ({
      title: 'Fast-Track Priority Declined',
      body: `Fast-Track request for Token #${p.tokenNumber || ''} was declined. Reason: ${p.reason || 'Yard congestion limit'}.`
    }),
    hi: (p) => ({
      title: 'फास्ट-ट्रैक प्राथमिकता अस्वीकृत',
      body: `टोकन #${p.tokenNumber || ''} का फास्ट-ट्रैक अनुरोध अस्वीकृत हुआ। कारण: ${p.reason || 'भीड़ सीमा'}।`
    }),
    mr: (p) => ({
      title: 'फास्ट-ट्रॅक प्राधान्य नाकारले',
      body: `टोकन #${p.tokenNumber || ''} ची विनंती नाकारली. कारण: ${p.reason || 'यार्ड क्षमता मर्यादा'}.`
    })
  },

  redirect_offer: {
    en: (p) => ({
      title: 'Mandi Redirection Offer',
      body: `Congestion at ${p.fromCentre || 'current mandi'}. Recommended transfer to ${p.toCentre || 'nearby mandi'} with priority slot.`
    }),
    hi: (p) => ({
      title: 'मंडी पुनर्निर्देशन प्रस्ताव',
      body: `${p.fromCentre || 'वर्तमान मंडी'} में भीड़। प्राथमिकता स्लॉट के साथ ${p.toCentre || 'निकटवर्ती मंडी'} में स्थानांतरण का सुझाव।`
    }),
    mr: (p) => ({
      title: 'मंडी पुनर्निर्देशन प्रस्ताव',
      body: `${p.fromCentre || 'सध्याच्या मंडी'}मध्ये गर्दी. प्राधान्य स्लॉटसह ${p.toCentre || 'जवळच्या मंडी'}मध्ये जाण्याचा पर्याय उपलब्ध.`
    })
  },

  complaint_received: {
    en: (p) => ({
      title: 'Grievance Registered',
      body: `Complaint #${p.complaintId || ''} received for checkpoint ${p.checkpoint || ''}. Mandi Supervisor notified.`
    }),
    hi: (p) => ({
      title: 'शिकायत दर्ज',
      body: `चेकपॉइंट ${p.checkpoint || ''} हेतु शिकायत #${p.complaintId || ''} दर्ज हुई। पर्यवेक्षक को सूचित किया गया।`
    }),
    mr: (p) => ({
      title: 'तक्रार नोंदवली गेली',
      body: `चेकपॉइंट ${p.checkpoint || ''} साठी तक्रार #${p.complaintId || ''} नोंदवली. पर्यवेक्षकांना कळवले.`
    })
  },

  complaint_resolved: {
    en: (p) => ({
      title: 'Grievance Resolved',
      body: `Complaint #${p.complaintId || ''} resolved by Supervisor. Resolution: ${p.resolutionNotes || 'Issue addressed'}.`
    }),
    hi: (p) => ({
      title: 'शिकायत का निवारण हुआ',
      body: `पर्यवेक्षक द्वारा शिकायत #${p.complaintId || ''} का निवारण किया गया। टिप्पणी: ${p.resolutionNotes || 'समाधान किया गया'}।`
    }),
    mr: (p) => ({
      title: 'तक्रार निवारण झाले',
      body: `पर्यवेक्षकांद्वारे तक्रार #${p.complaintId || ''} चे निवारण झाले. शेरा: ${p.resolutionNotes || 'समस्या सोडवली'}.`
    })
  },

  exception_raised: {
    en: (p) => ({
      title: 'Discrepancy Flagged',
      body: `Exception flagged on Token #${p.tokenNumber || ''} (${p.category || 'Quality/Identity'}). Routed to Supervisor desk.`
    }),
    hi: (p) => ({
      title: 'विसंगति दर्ज',
      body: `टोकन #${p.tokenNumber || ''} पर त्रुटि दर्ज (${p.category || 'गुणवत्ता/पहचान'})। पर्यवेक्षक को भेजी गई।`
    }),
    mr: (p) => ({
      title: 'तफावत आढळली',
      body: `टोकन #${p.tokenNumber || ''} वर त्रुटी नोंदवली गेली (${p.category || 'गुणवत्ता/ओळख'}). पर्यवेक्षक कक्षाकडे वर्ग.`
    })
  }
};

/**
 * Render notification title and body
 * @param {string} event - Event name
 * @param {object} payload - Template data
 * @param {string} lang - 'en' | 'hi' | 'mr'
 * @returns {{ title: string, body: string }}
 */
function renderTemplate(event, payload = {}, lang = 'en') {
  const normalizedLang = ['en', 'hi', 'mr'].includes(lang) ? lang : 'en';
  const templateGroup = TEMPLATES[event];

  if (templateGroup && templateGroup[normalizedLang]) {
    return templateGroup[normalizedLang](payload);
  }

  // Fallback to English if language template missing
  if (templateGroup && templateGroup.en) {
    return templateGroup.en(payload);
  }

  // Generic fallback
  const eventLabel = event ? String(event).replace(/_/g, ' ').toUpperCase() : 'GENERAL';
  return {
    title: payload.title || `Notification: ${eventLabel}`,
    body: payload.body || payload.message || `Update for your KisanQ service (${eventLabel}).`
  };
}

module.exports = {
  TEMPLATES,
  renderTemplate
};
