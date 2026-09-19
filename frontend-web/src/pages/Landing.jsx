import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { pricesApi } from '../api';
import GovHeader from '../components/common/GovHeader';
import heroBg from '../assets/hero-bg.webp';
import {
  Leaf, Sprout, ShieldCheck, Mic, Users, Clock, Layers,
  RefreshCw, Zap, Bot, ShieldAlert, Printer, Radio,
  BarChart3, Share2, CheckCircle2, ArrowRight, Lock, Phone,
  Mail, User, Key, Sparkles, Building2, Navigation, Scale,
  FileText, ChevronRight, Globe, Check, AlertCircle, ArrowUpRight,
  TrendingUp, Landmark, Shield, Cpu, Award, MapPin, Truck
} from 'lucide-react';

// ─── Trilingual Content Dictionary ────────────────────────────────────────────
const DICTIONARY = {
  en: {
    hero: {
      badge: 'Smart Agricultural Queue & Logistics Network',
      headlineStart: 'Sell Produce Faster,',
      headlineEnd: 'Skip the Mandi Queue.',
      subheadline:
        'AI departure scheduling, live OSRM routing, instant weighbridge passes, and direct bank payouts for Maharashtra’s farmers.',
      stats: [
        { value: '5 APMCs', label: 'Connected Regional Mandis' },
        { value: '~4.2 min', label: 'Average Gate Clearance' },
        { value: '100% MSP', label: 'Guaranteed Direct Price' },
        { value: '₹0 Cut', label: 'Instant Bank Payout' },
      ],
    },
    auth: {
      tabLogin: 'Farmer Login',
      tabRegister: 'New Registration',
      fullNameLabel: 'Farmer Name',
      fullNamePlaceholder: 'e.g., Mahesh Borde',
      emailLabel: 'Email Address (Optional)',
      emailPlaceholder: 'mahesh.farmer@kisanq.in',
      mobileLabel: 'Mobile Number',
      mobilePlaceholder: '9876543210',
      passwordLabel: 'Passcode / PIN',
      passwordPlaceholder: 'Enter 4-6 digit Passcode',
      otpLabel: '6-Digit Verification OTP',
      otpPlaceholder: 'Enter OTP (999999)',
      btnSendOtp: 'Send Verification OTP',
      btnVerifyLogin: 'Sign In & Open Dashboard',
      btnRegister: 'Register & Book Slot',
      btnQuickDemo: '⚡ 1-Click Quick Demo Login (Mahesh Borde)',
      otpSentNotice: 'OTP sent! Use demo verification code: 999999',
      secureNotice: 'Secure 256-bit encrypted authentication',
    },
    featuresHeading: {
      tag: 'Platform Capabilities',
      title: 'Engineered for Zero-Wait Farm Logistics',
      subtitle:
        'A unified platform connecting farmers, weighbridges, quality labs, and treasury for seamless produce sales.',
    },
    features: [
      {
        id: 1,
        title: 'Voice & Smart Booking',
        desc: 'Book slot in seconds via Voice AI Whisper, WhatsApp, or instant web interface.',
        badge: 'Easy Booking',
      },
      {
        id: 2,
        title: 'AgriPool Freight Sharing',
        desc: 'Combine tractor loads with neighbors within 500m to slash transportation costs by 60%.',
        badge: 'Save Freight',
      },
      {
        id: 3,
        title: 'Dynamic "Leave-By" Timer',
        desc: 'Calculates exact home departure time using live highway traffic and gate queue speed.',
        badge: 'Zero Wait',
      },
      {
        id: 5,
        title: 'Dedicated Crop Lanes',
        desc: 'Separate fast-track intake lanes for Wheat, Soybean, Onion, and Cotton.',
        badge: 'Intake Lanes',
      },
      {
        id: 6,
        title: 'Real-Time Auto Advance',
        desc: 'Instant queue progression and notification when upstream slots clear ahead of time.',
        badge: 'Live Queue',
      },
      {
        id: 7,
        title: 'Express Priority Slots',
        desc: 'Regulated priority booking windows for urgent perishable produce batches.',
        badge: 'Priority Slips',
      },
      {
        id: 8,
        title: 'AI Gate Surge Balancing',
        desc: 'Predictive intake balancing to open extra weighbridges before traffic peaks.',
        badge: 'Smart Intake',
      },
      {
        id: 9,
        title: 'TrustGuard Weight Lock',
        desc: 'Automated anti-tamper telemetry preventing weighbridge tare discrepancies.',
        badge: 'Verified Weight',
      },
      {
        id: 11,
        title: 'Digital Verification Receipts',
        desc: 'Download and print verified electronic receipts with officer audit signatures.',
        badge: 'Instant Slips',
      },
      {
        id: 12,
        title: 'IoT Gate Automation',
        desc: 'Automated boom barriers synced directly with real-time arrival QR codes.',
        badge: 'Smart Barriers',
      },
      {
        id: 14,
        title: '72-Hour Market Radar',
        desc: 'Regional arrival forecasting helping Mandis prepare smooth intake capacities.',
        badge: 'Volume Radar',
      },
      {
        id: 15,
        title: 'Pre-Arrival Buyer Sync',
        desc: 'Broadcasts verified transit produce volumes directly to registered buyers.',
        badge: 'Direct Market',
      },
    ],
    footer: {
      text: 'KisanQ Mandi Queue & Physical Logistics Operating System.',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      contact: 'KisanQ Support Helpline: 1800-233-5472 (Toll Free, 24x7)',
    },
  },

  hi: {
    hero: {
      badge: 'स्मार्ट कृषि कतार एवं लॉजिस्टिक्स नेटवर्क',
      headlineStart: 'फसल बेचें तेज़ी से,',
      headlineEnd: 'मंडी की कतार से पाएं मुक्ति।',
      subheadline:
        'एआई प्रस्थान समय निर्धारण, लाइव ओएसआरएम नेविगेशन, डिजिटल वजनकांटा पर्ची और सीधा बैंक भुगतान।',
      stats: [
        { value: '5 एपीएमसी', label: 'संबद्ध क्षेत्रीय मंडियां' },
        { value: '~4.2 मिनट', label: 'औसत गेट निकासी समय' },
        { value: '100% एमएसपी', label: 'न्यूनतम समर्थन मूल्य गारंटी' },
        { value: '₹0 दलाली', label: 'सीधा बैंक खाता भुगतान' },
      ],
    },
    auth: {
      tabLogin: 'किसान लॉगिन',
      tabRegister: 'नवीन पंजीकरण',
      fullNameLabel: 'किसान का पूरा नाम',
      fullNamePlaceholder: 'उदा. महेश बोर्डे',
      emailLabel: 'ईमेल पता (वैकल्पिक)',
      emailPlaceholder: 'mahesh.farmer@kisanq.in',
      mobileLabel: 'मोबाइल नंबर',
      mobilePlaceholder: '9876543210',
      passwordLabel: 'सुरक्षा पिन / पासवर्ड',
      passwordPlaceholder: '४-६ अंकीय पिन दर्ज करें',
      otpLabel: '६-अंकीय सत्यापन ओटीपी',
      otpPlaceholder: 'ओटीपी दर्ज करें (999999)',
      btnSendOtp: 'ओटीपी प्राप्त करें',
      btnVerifyLogin: 'सत्यापित करें और प्रवेश करें',
      btnRegister: 'पंजीकरण पूर्ण करें',
      btnQuickDemo: '⚡ 1-क्लिक त्वरित डेमो लॉगिन (महेश बोर्डे)',
      otpSentNotice: 'ओटीपी भेजा गया! डेमो कोड: 999999 का उपयोग करें',
      secureNotice: 'सुरक्षित एवं एन्क्रिप्टेड पोर्टल',
    },
    featuresHeading: {
      tag: 'मंच की मुख्य विशेषताएं',
      title: 'शून्य प्रतीक्षा मंडी लॉजिस्टिक्स प्रणाली',
      subtitle:
        'किसान, वजनकांटा, गुणवत्ता प्रयोगशाला एवं भुगतान विभाग को जोड़ने वाला आधुनिक डिजिटल समाधान।',
    },
    features: [
      {
        id: 1,
        title: 'आवाज़ एवं स्मार्ट बुकिंग',
        desc: 'वॉइस व्हिस्पर एआई, व्हाट्सएप या सीधे वेब से कुछ ही सेकंड में स्लॉट बुक करें।',
        badge: 'आसान बुकिंग',
      },
      {
        id: 2,
        title: 'एग्रीपूल साझा ढुलाई',
        desc: '५०० मीटर दायरे में पड़ोसियों के साथ ट्रैक्टर साझा करें और भाड़ा ६०% तक घटाएं।',
        badge: 'भाड़ा बचत',
      },
      {
        id: 3,
        title: 'डायनामिक प्रस्थान टाइमर',
        desc: 'सड़क पर ट्रैफ़िक और मंडी गेट की गति के अनुसार घर से निकलने का सही समय पाएं।',
        badge: 'शून्य प्रतीक्षा',
      },
      {
        id: 5,
        title: 'फसलवार समर्पित लेन',
        desc: 'गेहूं, सोयाबीन, प्याज और कपास के लिए अलग प्रवेश लेन।',
        badge: 'अलग लेन',
      },
      {
        id: 6,
        title: 'लाइव कतार ऑटो-एडवांस',
        desc: 'कतार आगे बढ़ने पर स्वचालित प्रगति और फोन पर तुरंत सूचना।',
        badge: 'लाइव कतार',
      },
      {
        id: 7,
        title: 'एक्सप्रेस प्राथमिकता स्लॉट',
        desc: 'जल्दी खराब होने वाली उपज के लिए नियमित प्राथमिकता स्लॉट।',
        badge: 'प्राथमिकता',
      },
      {
        id: 8,
        title: 'स्मार्ट आवक संतुलन',
        desc: 'भीड़ बढ़ने से पहले अतिरिक्त वजनकांटे और जांच काउंटर खोलने की व्यवस्था।',
        badge: 'स्मार्ट संचालन',
      },
      {
        id: 9,
        title: 'वजन सत्यापन लॉक',
        desc: 'सटीक वजनकांटा टेलीमेट्री जो किसी भी गड़बड़ी को रोकती है।',
        badge: 'सटीक वजन',
      },
      {
        id: 11,
        title: 'डिजिटल सत्यापन रसीदें',
        desc: 'अधिकारी हस्ताक्षर के साथ तुरंत डिजिटल सत्यापन रसीद डाउनलोड करें।',
        badge: 'डिजिटल पर्ची',
      },
      {
        id: 12,
        title: 'स्मार्ट गेट ऑटोमेशन',
        desc: 'क्यूआर कोड स्कैन होते ही स्वचालित बूम बैरियर खुलते हैं।',
        badge: 'स्वचालित बैरियर',
      },
      {
        id: 14,
        title: '७२-घंटे बाजार रडार',
        desc: 'मंडी में संभावित आवक का पूर्वानुमान ताकि सुचारू संचालन बना रहे।',
        badge: 'आवक रडार',
      },
      {
        id: 15,
        title: 'व्यापारी सीधा संपर्क',
        desc: 'मंडी पहुंचने से पहले ही पंजीकृत खरीदारों को उपज की पुष्टि।',
        badge: 'सीधा बाजार',
      },
    ],
    footer: {
      text: 'किसानक्यू स्मार्ट मंडी कतार एवं लॉजिस्टिक्स प्रणाली।',
      privacy: 'गोपनीयता नीति',
      terms: 'उपयोग की शर्तें',
      contact: 'किसान हेल्पलाइन: 1800-233-5472 (टोल फ्री, 24x7)',
    },
  },

  mr: {
    hero: {
      badge: 'स्मार्ट कृषी रांग व वाहतूक नेटवर्क',
      headlineStart: 'शेतमाल विका झटपट,',
      headlineEnd: 'बाजार समितीच्या रांगेतून मुक्ती.',
      subheadline:
        'एआय आधारित निघण्याची वेळ, अचूक नेव्हिगेशन, डिजिटल वजनकाटा पावती आणि थेट बँक खात्यात चुकारा.',
      stats: [
        { value: '५ बाजार समित्या', label: 'जोडलेली प्रमुख केंद्रे' },
        { value: '~४.२ मिनिटे', label: 'सरासरी गेट प्रवेश वेळ' },
        { value: '१००% हमीभाव', label: 'हमीभाव सुरक्षा' },
        { value: '₹० अडत', label: 'थेट बँक खात्यात जमा' },
      ],
    },
    auth: {
      tabLogin: 'शेतकरी लॉगिन',
      tabRegister: 'नवीन नोंदणी',
      fullNameLabel: 'शेतकऱ्याचे नाव',
      fullNamePlaceholder: 'उदा. महेश बोर्डे',
      emailLabel: 'ईमेल (पर्यायी)',
      emailPlaceholder: 'mahesh.farmer@kisanq.in',
      mobileLabel: 'मोबाईल नंबर',
      mobilePlaceholder: '9876543210',
      passwordLabel: 'पासवर्ड / पिन',
      passwordPlaceholder: '४-६ अंकी पिन टाका',
      otpLabel: '६-अंकी पडताळणी ओटीपी',
      otpPlaceholder: 'ओटीपी टाका (999999)',
      btnSendOtp: 'ओटीपी पाठवा',
      btnVerifyLogin: 'पडताळणी करा व सुरू करा',
      btnRegister: 'नोंदणी करा व स्लॉट बुक करा',
      btnQuickDemo: '⚡ १-क्लिक जलद डेमो लॉगिन (महेश बोर्डे)',
      otpSentNotice: 'ओटीपी पाठवला आहे! डेमो कोड: 999999 वापरा',
      secureNotice: 'सुरक्षित व एन्क्रिप्टेड प्रणाली',
    },
    featuresHeading: {
      tag: 'प्लॅटफॉर्म वैशिष्ट्ये',
      title: 'शून्य प्रतीक्षा शेतमाल वाहतूक प्रणाली',
      subtitle:
        'शेतकरी, वजनकाटा, प्रतवारी आणि हिशोब विभाग यांना जोडणारी अत्याधुनिक डिजिटल व्यवस्था.',
    },
    features: [
      {
        id: 1,
        title: 'व्हॉइस व स्मार्ट बुकिंग',
        desc: 'व्हॉइस एआय, व्हॉट्सअ‍ॅप किंवा वेबद्वारे काही सेकंदांत स्लॉट बुक करा.',
        badge: 'सुलभ बुकिंग',
      },
      {
        id: 2,
        title: 'अ‍ॅग्रीपूल सामायिक वाहतूक',
        desc: '५०० मीटर अंतरातील शेतकऱ्यांसोबत एकत्र वाहतूक करून ६०% भाडे वाचवा.',
        badge: 'भाडे बचत',
      },
      {
        id: 3,
        title: 'निघण्याची वेळ टाइमर',
        desc: 'रस्त्यावरील वाहतूक आणि गेटच्या वेगानुसार घरून निघण्याची अचूक वेळ.',
        badge: 'वेळेची बचत',
      },
      {
        id: 5,
        title: 'स्वतंत्र पीक मार्ग',
        desc: 'गहू, सोयाबीन, कांदा व कापसासाठी स्वतंत्र जलद प्रवेश मार्ग.',
        badge: 'स्वतंत्र लेन',
      },
      {
        id: 6,
        title: 'रिअल-टाइम रांग अपडेट',
        desc: 'रांग पुढे सरकल्यास तात्काळ फोनवर सूचना व अपडेट.',
        badge: 'थेट रांग',
      },
      {
        id: 7,
        title: 'प्राधान्य स्लॉट',
        desc: 'तात्काळ शेतमालासाठी नियमित प्राधान्य बुकिंग व्यवस्था.',
        badge: 'प्राधान्य',
      },
      {
        id: 8,
        title: 'स्मार्ट आवक नियोजन',
        desc: 'गर्दीपूर्वीच अतिरिक्त वजनकाटे व अधिकारी सुरू करण्याचे नियोजन.',
        badge: 'स्मार्ट नियोजन',
      },
      {
        id: 9,
        title: 'वजनकाटा सुरक्षा लॉक',
        desc: 'वजनकाट्यात फेरफार रोखणारी स्वयंचलित डिजिटल सुरक्षा.',
        badge: 'अचूक वजन',
      },
      {
        id: 11,
        title: 'डिजिटल पावत्या',
        desc: 'प्रत्येक टप्प्यावर अधिकाऱ्यांच्या डिजिटल सहीसह अधिकृत पावती.',
        badge: 'ई-पावती',
      },
      {
        id: 12,
        title: 'स्वयंचलित गेट बॅरियर',
        desc: 'क्युआर कोड स्कॅन होताच स्वयंचलित गेट बॅरियर उघडते.',
        badge: 'स्मार्ट बॅरियर',
      },
      {
        id: 14,
        title: '७२-तास बाजार अंदाज',
        desc: 'संभाव्य आवकेचा आधीच अंदाज जेणेकरून सुरळीत कारभार राहतो.',
        badge: 'आवक अंदाज',
      },
      {
        id: 15,
        title: 'थेट व्यापारी मेळ',
        desc: 'गेटवर पोहोचण्यापूर्वीच नोंदणीकृत व्यापाऱ्यांना शेतमालाची माहिती.',
        badge: 'थेट बाजार',
      },
    ],
    footer: {
      text: 'किसानक्यू स्मार्ट कृषी उत्पन्न बाजार समिती व्यवस्थापन प्रणाली.',
      privacy: 'गोपनीयता धोरण',
      terms: 'नियम व अटी',
      contact: 'शेतकरी हेल्पलाइन: 1800-233-5472 (टोल फ्री, २४x७)',
    },
  },
};

const FEATURE_ICONS = {
  1: Mic,
  2: Users,
  3: Clock,
  5: Layers,
  6: RefreshCw,
  7: Zap,
  8: Bot,
  9: ShieldAlert,
  11: Printer,
  12: Radio,
  14: BarChart3,
  15: Share2,
};

// Live Mandi Ticker Data Fallback
const FALLBACK_MANDI_RATES = [
  { mandi: 'APMC Kopargaon', crop: 'Soybean', rate: '₹4,950/Qtl', trend: '+₹70', activeSlots: 42, status: 'Fast Flow' },
  { mandi: 'APMC Shirdi', crop: 'Soybean', rate: '₹4,950/Qtl', trend: '+₹65', activeSlots: 28, status: 'Optimal' },
  { mandi: 'APMC Rahata', crop: 'Wheat', rate: '₹2,465/Qtl', trend: '+₹50', activeSlots: 56, status: 'Moderate' },
  { mandi: 'APMC Vaijapur', crop: 'Cotton', rate: '₹7,280/Qtl', trend: '+₹130', activeSlots: 19, status: 'Clear Flow' },
  { mandi: 'APMC Shrirampur', crop: 'Soybean', rate: '₹4,960/Qtl', trend: '+₹70', activeSlots: 35, status: 'Active Intake' },
  { mandi: 'APMC Lasalgaon', crop: 'Onion', rate: '₹2,020/Qtl', trend: '+₹50', activeSlots: 48, status: 'High Flow' },
];

const MANDI_NAMES = {
  'KPG-01': 'APMC Kopargaon',
  'SRD-02': 'APMC Shirdi',
  'RHT-03': 'APMC Rahata',
  'VJP-04': 'APMC Vaijapur',
  'SRP-05': 'APMC Shrirampur',
  'LSG-06': 'APMC Lasalgaon',
};

// ─── Desktop Live Mandi Rates Ticker (Zero Re-renders, Desktop Mouse Drag & Auto-Marquee) ──────
const DesktopMandiTicker = ({ mandiRates }) => {
  const containerRef = useRef(null);
  const isPausedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);

  // Duplicate rates array to guarantee a seamless infinite marquee loop
  const displayRates =
    mandiRates && mandiRates.length > 0
      ? mandiRates.length < 6
        ? [...mandiRates, ...mandiRates, ...mandiRates, ...mandiRates]
        : [...mandiRates, ...mandiRates]
      : [];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId;
    let lastTimestamp = null;
    const scrollSpeed = 35; // readable horizontal velocity (px/sec)

    const animate = (timestamp) => {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      // Auto-scroll only when not paused by mouse hover and not actively dragged
      if (!isPausedRef.current && !isDraggingRef.current && container) {
        const halfWidth = container.scrollWidth / 2;
        if (halfWidth > 0) {
          let nextScrollLeft = container.scrollLeft + scrollSpeed * delta;
          if (nextScrollLeft >= halfWidth) {
            nextScrollLeft -= halfWidth;
          }
          container.scrollLeft = nextScrollLeft;
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [displayRates.length]);

  // Desktop Mouse Event Handlers (Desktop Only - strictly no touch handlers)
  const handleMouseEnter = () => {
    isPausedRef.current = true;
  };

  const handleMouseLeave = () => {
    isPausedRef.current = false;
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grab';
        containerRef.current.style.removeProperty('user-select');
      }
    }
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0 || !containerRef.current) return;
    isPausedRef.current = true;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - containerRef.current.offsetLeft;
    startScrollLeftRef.current = containerRef.current.scrollLeft;

    containerRef.current.style.cursor = 'grabbing';
    containerRef.current.style.userSelect = 'none';
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const x = e.pageX - containerRef.current.offsetLeft;
    const distance = x - startXRef.current;

    // Suppress child click events if mouse was dragged more than 3px
    if (Math.abs(distance) > 3) {
      hasDraggedRef.current = true;
    }

    let targetScroll = startScrollLeftRef.current - distance;
    const halfWidth = containerRef.current.scrollWidth / 2;
    if (halfWidth > 0) {
      while (targetScroll >= halfWidth) targetScroll -= halfWidth;
      while (targetScroll < 0) targetScroll += halfWidth;
    }
    containerRef.current.scrollLeft = targetScroll;
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grab';
        containerRef.current.style.removeProperty('user-select');
      }
    }
  };

  const handleClickCapture = (e) => {
    if (hasDraggedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      hasDraggedRef.current = false;
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClickCapture={handleClickCapture}
      className="flex items-center gap-4 overflow-x-hidden py-0.5 scrollbar-none text-xs cursor-grab select-none flex-1 min-w-0"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {displayRates.map((item, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2 whitespace-nowrap bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700/80 hover:border-slate-600 transition-colors shrink-0"
        >
          <span className="font-semibold text-slate-300 text-[11px]">{item.mandi}</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-100 font-bold">{item.crop}</span>
          <span className="text-emerald-400 font-black">{item.rate}</span>
          <span
            className={`text-[10px] font-bold ${
              item.trend.startsWith('+')
                ? 'text-emerald-400'
                : item.trend.startsWith('-')
                ? 'text-rose-400'
                : 'text-slate-400'
            }`}
          >
            ({item.trend})
          </span>
          <span className="text-[9px] px-1.5 py-0.2 bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 rounded uppercase font-medium">
            {item.activeSlots} slots open
          </span>
        </div>
      ))}
    </div>
  );
};

export default function Landing() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [lang, setLang] = useState(() => localStorage.getItem('kisanq_lang') || 'en');

  const handleLanguageChange = (newLang) => {
    setLang(newLang);
    localStorage.setItem('kisanq_lang', newLang);
  };

  const t = DICTIONARY[lang] || DICTIONARY.en;

  const { farmerOtpRequest, farmerOtpVerify, clearFarmerSession } = useAuth();

  // Live Mandi Rates State
  const [mandiRates, setMandiRates] = useState(FALLBACK_MANDI_RATES);

  // Fetch live unified crop prices on mount
  useEffect(() => {
    let isMounted = true;
    const fetchRates = async () => {
      try {
        const res = await pricesApi.getAllPrices();
        const priceList = Array.isArray(res) ? res : res?.data || [];
        if (isMounted && priceList.length > 0) {
          const formatted = priceList.map((item, idx) => {
            const mandiName = MANDI_NAMES[item.mandiId] || item.mandiId;
            const prev = item.marketPriceYesterday !== null && item.marketPriceYesterday !== undefined ? item.marketPriceYesterday : item.mspPrice;
            const diff = item.marketPriceToday - prev;
            const trend = diff >= 0 ? `+₹${diff}` : `-₹${Math.abs(diff)}`;
            return {
              mandi: mandiName,
              crop: item.crop,
              rate: `₹${item.marketPriceToday.toLocaleString('en-IN')}/Qtl`,
              trend: trend,
              activeSlots: 20 + ((idx * 7) % 30),
              status: 'Live APMC'
            };
          });
          setMandiRates(formatted);
        }
      } catch (err) {
        console.debug('Failed to fetch live mandi rates for ticker:', err.message);
      }
    };
    fetchRates();
    return () => { isMounted = false; };
  }, []);

  // Authentication State
  const [authTab, setAuthTab] = useState('login');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('999999');

  // Clear any leftover/stale farmer session when initiating auth flow
  useEffect(() => {
    clearFarmerSession();
  }, [clearFarmerSession]);

  // Support direct URL query tab switching e.g. /?tab=register
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'register') {
        setAuthTab('register');
      } else if (tabParam === 'login') {
        setAuthTab('login');
      }
    } catch {}
  }, []);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }
    if (authTab === 'login' && !password.trim()) {
      setErrorMsg('Please enter your Passcode / PIN');
      return;
    }
    if (authTab === 'register' && !password.trim()) {
      setErrorMsg('Please set a Passcode / PIN for your account');
      return;
    }

    setLoading(true);
    try {
      await farmerOtpRequest({
        phone: cleanPhone,
        name: fullName.trim() || undefined,
        preferredLanguage: lang,
        registeredVia: 'app',
        passcode: password.trim() || undefined,
        mode: authTab
      });
      setErrorMsg('');
      setOtp('999999');
      setStep(2);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to request verification code';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanOtp = otp.trim();

    if (!cleanOtp || cleanOtp.length !== 6) {
      setErrorMsg('Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const res = await farmerOtpVerify({
        phone: cleanPhone,
        otp: cleanOtp,
        name: fullName.trim() || undefined,
        preferredLanguage: lang,
        registeredVia: 'app',
        passcode: password.trim() || undefined,
        mode: authTab
      });
      if (res?.data?.token || res?.token) {
        navigate('/farmer/command-center');
      } else {
        setErrorMsg('Authentication failed. Please verify code.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Invalid or expired OTP';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    try {
      setLoading(true);
      await farmerOtpVerify({
        phone: '9876543210',
        otp: '123456',
        name: 'Mahesh Borde',
        preferredLanguage: lang,
        registeredVia: 'app',
        mode: 'login'
      });
      navigate('/farmer/command-center');
    } catch {
      navigate('/farmer/command-center');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-600 selection:text-white">
      {/* ── Modern Navbar ────────────────────────────────────────── */}
      <GovHeader
        portalType="farmer"
        currentLang={lang}
        onLanguageChange={handleLanguageChange}
        showPortalSwitch={true}
      />

      {/* ── Live Rates Ticker Strip ──────────────────────────────── */}
      <div className="bg-slate-900 text-slate-200 py-2.5 px-4 border-b border-slate-800 overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs gap-4">
          <div className="flex items-center gap-2 shrink-0 font-semibold text-emerald-400">
            <TrendingUp className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="uppercase tracking-wider text-[11px] font-bold">Live Mandi Rates:</span>
          </div>

          <DesktopMandiTicker mandiRates={mandiRates} />

          <div className="hidden lg:flex items-center gap-2 shrink-0 text-[11px] text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Live Telemetry</span>
          </div>
        </div>
      </div>

      {/* ── Hero Section with Modern Auth Card & Hero Background ─── */}
      <section className="relative overflow-hidden bg-slate-100 border-b border-slate-200">
        {/* High-Visibility APMC & Farmer Hero Graphic Backdrop */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-90 pointer-events-none"
          style={{ backgroundImage: `url(${heroBg})` }}
        />

        {/* Soft Gradient Overlay for Text Readability without Obscuring Artwork */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-50/85 via-slate-50/50 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-100/90 via-transparent to-black/10 pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-10 pb-16 lg:pt-14 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Column: Hero Content */}
            <div className="lg:col-span-7 space-y-6">
            {/* Live Network Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t.hero.badge}</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              {t.hero.headlineStart}{' '}
              <span className="text-emerald-600">
                {t.hero.headlineEnd}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
              {t.hero.subheadline}
            </p>

            {/* Floating Metric Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {t.hero.stats.map((stat, i) => (
                <div
                  key={i}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all"
                >
                  <div className="font-extrabold text-xl sm:text-2xl text-slate-900 font-mono">
                    {stat.value}
                  </div>
                  <div className="text-xs font-semibold text-slate-500 mt-1 leading-snug">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* 1-Click Quick Demo Login Button (Gated for Judge Demos) */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              {(import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true' || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'true')) && (
                <button
                  type="button"
                  onClick={handleQuickDemoLogin}
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-600/25 active:scale-[0.99]"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{t.auth.btnQuickDemo}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              <Link
                to="/staff-login"
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-xs transition-all"
              >
                <Building2 className="w-4 h-4 text-slate-500" />
                <span>Mandi Staff Desk →</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Modern Sleek Auth Card */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 sm:p-8 relative overflow-hidden">
              
              {/* Header Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => { setAuthTab('login'); setStep(1); setErrorMsg(''); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    authTab === 'login'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.auth.tabLogin}
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('register'); setStep(1); setErrorMsg(''); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    authTab === 'register'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.auth.tabRegister}
                </button>
              </div>

              {/* Error Notice */}
              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  {authTab === 'login' && errorMsg.toLowerCase().includes('not registered') && (
                    <button
                      type="button"
                      onClick={() => { setAuthTab('register'); setStep(1); setErrorMsg(''); }}
                      className="mt-2 text-emerald-700 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      → {t.auth.tabRegister} (Click to Register)
                    </button>
                  )}
                  {authTab === 'register' && errorMsg.toLowerCase().includes('already registered') && (
                    <button
                      type="button"
                      onClick={() => { setAuthTab('login'); setStep(1); setErrorMsg(''); }}
                      className="mt-2 text-emerald-700 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      → {t.auth.tabLogin} (Click to Sign In)
                    </button>
                  )}
                </div>
              )}

              {/* Step 1: Mobile & Password */}
              {step === 1 ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  {authTab === 'register' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          {t.auth.fullNameLabel}
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder={t.auth.fullNamePlaceholder}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          {t.auth.emailLabel}
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t.auth.emailPlaceholder}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t.auth.mobileLabel}
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-3 text-xs font-bold text-slate-400">
                        +91
                      </div>
                      <input
                        type="tel"
                        maxLength="10"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder={t.auth.mobilePlaceholder}
                        className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        {t.auth.passwordLabel}
                      </label>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t.auth.passwordPlaceholder}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all font-mono"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                  >
                    {loading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{t.auth.btnSendOtp}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Step 2: OTP Verification */
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {!errorMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                      <p className="font-semibold">{t.auth.otpSentNotice}</p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        {t.auth.otpLabel}
                      </label>
                      <button
                        type="button"
                        onClick={() => { setStep(1); setErrorMsg(''); }}
                        className="text-[11px] text-slate-500 hover:text-emerald-600 font-medium cursor-pointer"
                      >
                        Change number
                      </button>
                    </div>
                    <div className="relative">
                      <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        maxLength="6"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder={t.auth.otpPlaceholder}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white tracking-widest font-mono"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{authTab === 'login' ? t.auth.btnVerifyLogin : t.auth.btnRegister}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 font-medium text-center"
                  >
                    ← Back to credentials
                  </button>
                </form>
              )}

              {/* Security Badge */}
              <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t.auth.secureNotice}</span>
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>

      {/* ── Feature Showcase ────────────────────────────────────── */}
      <section className="bg-white py-16 lg:py-24 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-3">
              {t.featuresHeading.tag}
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
              {t.featuresHeading.title}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-3">
              {t.featuresHeading.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.features.map((feat) => {
              const IconComp = FEATURE_ICONS[feat.id] || Zap;
              return (
                <div
                  key={feat.id}
                  className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-6 transition-all shadow-xs hover:shadow-md group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <IconComp className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 group-hover:border-emerald-200 group-hover:text-emerald-700 transition-colors">
                      {feat.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1.5">
                    {feat.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ── Modern Footer ────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400 py-10 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black">
              K
            </div>
            <span className="font-bold text-slate-200 text-sm">
              Kisan<span className="text-emerald-400">Q</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">{t.footer.text}</span>
          </div>

          <div className="flex items-center gap-6">
            <span className="text-slate-400 font-medium">{t.footer.contact}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
