import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import { Storage } from '../../utils/storage';
import { COLORS } from '../../utils/constants';
import AgriPoolMatchModal from '../../components/AgriPoolMatchModal';
import VoiceBookingModal from '../../components/VoiceBookingModal';

const CROPS = [
  { id: 'Soybean', nameEn: 'Soybean', nameMr: 'सोयाबीन', nameHi: 'सोयाबीन', icon: '🌱' },
  { id: 'Cotton', nameEn: 'Cotton', nameMr: 'कापूस', nameHi: 'कपास', icon: '⚪' },
  { id: 'Wheat', nameEn: 'Wheat', nameMr: 'गहू', nameHi: 'गेहूं', icon: '🌾' },
  { id: 'Onion', nameEn: 'Onion', nameMr: 'कांदा', nameHi: 'प्याज', icon: '🧅' },
  { id: 'Maize', nameEn: 'Maize', nameMr: 'मका', nameHi: 'मक्का', icon: '🌽' },
  { id: 'Chana', nameEn: 'Chana', nameMr: 'हरभरा', nameHi: 'चना', icon: '🟤' }
];

const VEHICLES = [
  { id: 'Tractor', labelEn: 'Tractor', labelMr: 'ट्रॅक्टर', icon: '🚜' },
  { id: 'Mini Truck', labelEn: 'Mini Truck', labelMr: 'टेम्पो / ट्रक', icon: '🚚' },
  { id: 'Pickup', labelEn: 'Pickup', labelMr: 'पिकअप', icon: '🛻' },
  { id: 'Bullock Cart', labelEn: 'Bullock Cart', labelMr: 'बैलगाडी', icon: '🐂' }
];

const TIME_SLOTS = [
  { label: '08:00 AM - 10:00 AM' },
  { label: '10:00 AM - 12:00 PM' },
  { label: '12:00 PM - 02:00 PM' },
  { label: '02:00 PM - 04:00 PM' },
  { label: '04:00 PM - 06:00 PM' }
];

const DEFAULT_MANDIS = [
  { code: 'KPG-01', name: 'APMC Kopargaon', nameMr: 'कोपरगाव कृषी उत्पन्न बाजार समिती', district: 'Ahilyanagar' },
  { code: 'RHT-01', name: 'APMC Rahata', nameMr: 'राहाता कृषी उत्पन्न बाजार समिती', district: 'Ahilyanagar' },
  { code: 'SHR-01', name: 'APMC Shirdi', nameMr: 'शिर्डी उपबाजार समिती', district: 'Ahilyanagar' },
  { code: 'NSK-01', name: 'APMC Lasalgaon', nameMr: 'लासलगाव मुख्य बाजार समिती', district: 'Nashik' }
];

export default function BookingScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const preselected = route.params?.preselectedMandi;

  const [mandis, setMandis] = useState(DEFAULT_MANDIS);
  const [selectedMandi, setSelectedMandi] = useState(
    preselected?.code || 'KPG-01'
  );
  const [selectedCrop, setSelectedCrop] = useState('Soybean');
  const [quantity, setQuantity] = useState('25');
  const [selectedVehicle, setSelectedVehicle] = useState('Tractor');
  const [vehicleNumber, setVehicleNumber] = useState('MH-17-AB-1234');
  const [selectedDateIndex, setSelectedDateIndex] = useState(0); // 0: Today, 1: Tomorrow, 2: Day After
  const [selectedSlot, setSelectedSlot] = useState('08:00 AM - 10:00 AM');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successToken, setSuccessToken] = useState(null);
  const [agriPoolMatch, setAgriPoolMatch] = useState(null);
  const [showAgriPoolModal, setShowAgriPoolModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  const handleVoiceBookingConfirmed = async (bookingResult, collectedData) => {
    setShowVoiceModal(false);
    if (bookingResult && bookingResult.tokenNumber) {
      await Storage.setJson(Storage.ASYNC_KEYS.ACTIVE_TOKEN, bookingResult);
      setSuccessToken(bookingResult);
    } else if (collectedData) {
      if (collectedData.crop) setSelectedCrop(collectedData.crop);
      if (collectedData.quantity) setQuantity(String(collectedData.quantity));
      if (collectedData.centre) {
        const found = mandis.find(
          (m) =>
            m.name?.toLowerCase().includes(collectedData.centre.toLowerCase()) ||
            m.code?.toLowerCase().includes(collectedData.centre.toLowerCase()) ||
            (m.nameMr && m.nameMr.includes(collectedData.centre))
        );
        if (found) setSelectedMandi(found.code);
      }
    }
  };

  const isSlotExpired = (offsetDays, slotLabel) => {
    if (offsetDays > 0) return false;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const timeRegex = /(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i;
    const match = slotLabel.match(timeRegex);
    if (!match) return false;

    let endHour = parseInt(match[1], 10);
    const endMinute = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3] ? match[3].toUpperCase() : null;

    if (ampm === 'PM' && endHour < 12) {
      endHour += 12;
    } else if (ampm === 'AM' && endHour === 12) {
      endHour = 0;
    } else if (!ampm && endHour <= 6) {
      endHour += 12;
    }

    const slotEndMinutes = endHour * 60 + endMinute;
    // 15-minute buffer guard
    return currentMinutes >= (slotEndMinutes - 15);
  };

  const getFirstValidSlot = (dateOffset) => {
    const validSlot = TIME_SLOTS.find((s) => !isSlotExpired(dateOffset, s.label));
    return validSlot ? validSlot.label : TIME_SLOTS[0].label;
  };

  const areAllTodaySlotsExpired = TIME_SLOTS.every((s) => isSlotExpired(0, s.label));

  // Smart default selection: switch to Tomorrow if all Today slots are expired, or select first valid slot
  useEffect(() => {
    if (selectedDateIndex === 0 && areAllTodaySlotsExpired) {
      setSelectedDateIndex(1);
      setSelectedSlot(TIME_SLOTS[0].label);
    } else if (isSlotExpired(selectedDateIndex, selectedSlot)) {
      setSelectedSlot(getFirstValidSlot(selectedDateIndex));
    }
  }, [selectedDateIndex]);

  useEffect(() => {
    if (preselected?.code) {
      setSelectedMandi(preselected.code);
    }
  }, [preselected]);

  useEffect(() => {
    const loadCentres = async () => {
      try {
        const res = await client.get('/centres');
        const data = res.data?.data || res.data || [];
        if (Array.isArray(data) && data.length > 0) {
          setMandis(
            data.map((c) => ({
              code: c.code,
              name: c.name,
              nameMr: c.nameMarathi || c.name,
              district: c.district
            }))
          );
        }
      } catch (err) {
        console.warn('[BookingScreen] Centres list error:', err.message);
      }
    };
    loadCentres();
  }, []);

  const getSlotDateString = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  const getHumanFriendlyDate = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const dateStr = d.toLocaleDateString(i18n.language === 'mr' ? 'mr-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    if (offsetDays === 0) return `${t('today', 'Today')}, ${dateStr}`;
    if (offsetDays === 1) return `${t('tomorrow', 'Tomorrow')}, ${dateStr}`;
    return `${t('day_after', 'Day After')}, ${dateStr}`;
  };

  const handleQuickQty = (q) => {
    setQuantity(String(q));
  };

  const handleConfirmBooking = async () => {
    setErrorMessage('');
    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setErrorMessage('कृपया वैध प्रमाण टाका (Enter valid quantity)');
      return;
    }

    if (isSlotExpired(selectedDateIndex, selectedSlot)) {
      setErrorMessage(
        i18n.language === 'mr'
          ? 'हा वेळ स्लॉट संपला आहे. कृपया पुढील वेळ स्लॉट किंवा उद्याची तारीख निवडा.'
          : 'The selected arrival slot has already passed for today. Please choose a later slot or select tomorrow.'
      );
      return;
    }

    setIsLoading(true);

    try {
      // 1. Ensure farmer's pickup location is registered before booking (mandatory contract)
      try {
        await client.patch('/farmers/pickup-location', {
          latitude: 19.8928,
          longitude: 74.4820,
          address: 'Kopargaon Farm, Ahilyanagar'
        });
      } catch (pinErr) {
        console.warn('[Booking] Pickup pin set notice:', pinErr.message);
      }

      const activeMandi =
        mandis.find((m) => m.code === selectedMandi) || mandis[0];
      const slotDate = getSlotDateString(selectedDateIndex);

      const payload = {
        farmerName: user?.name || 'Mahesh Borde',
        farmerPhone: user?.phone || '9876543210',
        mandiId: activeMandi.code,
        mandiName: activeMandi.name,
        mandiCode: activeMandi.code.split('-')[0],
        crop: selectedCrop,
        quantity: parsedQty,
        slotDate,
        slotLabel: selectedSlot,
        slotTime: selectedSlot,
        vehicleType: selectedVehicle,
        vehicleNumber: vehicleNumber.trim() || 'MH-17-AB-1234',
        latitude: 19.8928,
        longitude: 74.4820
      };

      const response = await client.post('/tokens/book', payload);
      const bookedToken = response.data?.token || response.data?.data?.token;
      const match = response.data?.agriPoolMatch || response.data?.data?.agriPoolMatch;

      if (bookedToken) {
        await Storage.setJson(Storage.ASYNC_KEYS.ACTIVE_TOKEN, bookedToken);
        setSuccessToken(bookedToken);
        if (match) {
          setAgriPoolMatch(match);
          setShowAgriPoolModal(true);
        }
      } else {
        throw new Error('Booking response did not contain token details');
      }
    } catch (error) {
      console.warn('[Booking] Error:', error?.response?.data || error.message);
      const resData = error.response?.data;

      if (error.response?.status === 409) {
        // Active token already exists
        const existing = resData?.activeToken;
        Alert.alert(
          t('active_booking_title'),
          resData?.message || t('existing_token_alert'),
          [
            {
              text: t('view_booked_token'),
              onPress: () =>
                navigation.navigate('TokenDetails', {
                  token: existing || { tokenNumber: 'Active Pass' }
                })
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      } else {
        setErrorMessage(
          resData?.message || error.message || 'Booking submission failed'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>📅 {t('booking_title')}</Text>
          <Text style={styles.subtitle}>
            बाजार समिती निवड, पीक, प्रमाण व आवक वेळ निश्चित करा
          </Text>
        </View>

        {/* Success Modal / Banner */}
        {successToken ? (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>🎉</Text>
            <Text style={styles.successTitle}>{t('booking_success')}</Text>
            <Text style={styles.successSub}>{t('booking_success_sub')}</Text>
            <View style={styles.tokenHighlightBox}>
              <Text style={styles.tokenNumberLabel}>टोकन क्रमांक / Token #</Text>
              <Text style={styles.tokenNumberValue}>
                {successToken.tokenNumber}
              </Text>
              <Text style={styles.tokenDetailLine}>
                {successToken.mandiName} · {successToken.crop} ({successToken.quantity} Qtl)
              </Text>
              <Text style={styles.tokenSlotLine}>
                {successToken.slotDate} · {successToken.slotLabel || successToken.slotTime}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.viewPassButton}
              onPress={() => {
                const tok = successToken;
                setSuccessToken(null);
                navigation.navigate('TokenDetails', { token: tok });
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.viewPassButtonText}>
                🎟️ {t('view_booked_token')} →
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bookAnotherButton}
              onPress={() => setSuccessToken(null)}
            >
              <Text style={styles.bookAnotherText}>नवीन बुकिंग करा</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {/* Voice Booking Hero Banner */}
            <TouchableOpacity
              style={styles.voiceHeroCard}
              onPress={() => setShowVoiceModal(true)}
              activeOpacity={0.85}
            >
              <View style={styles.voiceHeroLeft}>
                <View style={styles.voiceHeroIconBg}>
                  <Text style={{ fontSize: 24 }}>🎙️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.voiceBadgeRow}>
                    <Text style={styles.voiceHeroTitle}>
                      {i18n.language === 'mr' ? 'स्मार्ट व्हॉईस बुकिंग' : i18n.language === 'hi' ? 'स्मार्ट वॉयस बुकिंग' : 'Smart Voice Booking'}
                    </Text>
                    <View style={styles.aiTag}>
                      <Text style={styles.aiTagText}>AI Voice</Text>
                    </View>
                  </View>
                  <Text style={styles.voiceHeroSubtitle}>
                    {i18n.language === 'mr'
                      ? 'फक्त बोलून २ मिनिटांत स्लॉट बुक करा (मराठी/हिन्दी/English)'
                      : i18n.language === 'hi'
                      ? 'बस बोलकर २ मिनट में स्लॉट बुक करें (मराठी/हिन्दी/English)'
                      : 'Speak naturally to book slot in 2 minutes (Marathi/Hindi/English)'}
                  </Text>
                </View>
              </View>
              <View style={styles.voiceHeroArrow}>
                <Text style={styles.voiceHeroArrowText}>
                  {i18n.language === 'mr' ? 'बोलून सुरू करा ▶' : i18n.language === 'hi' ? 'बोलकर शुरू करें ▶' : 'Start Voice Booking ▶'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Step 1: Select Mandi */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>१. {t('select_mandi')}</Text>
              <View style={styles.mandiList}>
                {mandis.map((m) => {
                  const isSelected = selectedMandi === m.code;
                  return (
                    <TouchableOpacity
                      key={m.code}
                      style={[
                        styles.mandiOption,
                        isSelected && styles.mandiOptionSelected
                      ]}
                      onPress={() => setSelectedMandi(m.code)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.mandiRadio}>
                        {isSelected && <View style={styles.mandiRadioInner} />}
                      </View>
                      <View style={styles.mandiTextCol}>
                        <Text
                          style={[
                            styles.mandiName,
                            isSelected && styles.mandiNameSelected
                          ]}
                        >
                          {i18n.language === 'mr' && m.nameMr ? m.nameMr : m.name}
                        </Text>
                        <Text style={styles.mandiDistrict}>
                          {m.code} · {m.district}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Step 2: Select Crop */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>२. {t('select_crop')}</Text>
              <View style={styles.cropsGrid}>
                {CROPS.map((crop) => {
                  const isSelected = selectedCrop === crop.id;
                  const cropName =
                    i18n.language === 'mr'
                      ? crop.nameMr
                      : i18n.language === 'hi'
                      ? crop.nameHi
                      : crop.nameEn;
                  return (
                    <TouchableOpacity
                      key={crop.id}
                      style={[
                        styles.cropCard,
                        isSelected && styles.cropCardSelected
                      ]}
                      onPress={() => setSelectedCrop(crop.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cropIcon}>{crop.icon}</Text>
                      <Text
                        style={[
                          styles.cropName,
                          isSelected && styles.cropNameSelected
                        ]}
                      >
                        {cropName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Step 3: Quantity & Mode of Transport */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                ३. {t('enter_quantity_quintals')}
              </Text>
              <View style={styles.qtyRow}>
                <TextInput
                  style={styles.qtyInput}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="25"
                />
                <Text style={styles.qtyUnit}>क्विंटल (Quintals)</Text>
              </View>

              {/* Quick Qty Chips */}
              <View style={styles.quickQtyRow}>
                {[10, 25, 50, 100].map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={[
                      styles.quickQtyChip,
                      quantity === String(q) && styles.quickQtyChipSelected
                    ]}
                    onPress={() => handleQuickQty(q)}
                  >
                    <Text
                      style={[
                        styles.quickQtyText,
                        quantity === String(q) && styles.quickQtyTextSelected
                      ]}
                    >
                      +{q} Qtl
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Vehicle Selection */}
              <Text style={[styles.sectionLabel, { marginTop: 14 }]}>
                {t('select_vehicle')}
              </Text>
              <View style={styles.vehicleGrid}>
                {VEHICLES.map((veh) => {
                  const isSelected = selectedVehicle === veh.id;
                  return (
                    <TouchableOpacity
                      key={veh.id}
                      style={[
                        styles.vehicleCard,
                        isSelected && styles.vehicleCardSelected
                      ]}
                      onPress={() => setSelectedVehicle(veh.id)}
                    >
                      <Text style={styles.vehicleIcon}>{veh.icon}</Text>
                      <Text
                        style={[
                          styles.vehicleName,
                          isSelected && styles.vehicleNameSelected
                        ]}
                      >
                        {i18n.language === 'mr' ? veh.labelMr : veh.labelEn}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Vehicle Number */}
              <Text style={[styles.sectionLabel, { marginTop: 12 }]}>
                {t('vehicle_number')}
              </Text>
              <TextInput
                style={styles.vehicleInput}
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
                placeholder={t('vehicle_number_placeholder')}
                autoCapitalize="characters"
              />
            </View>

            {/* Step 4: Date & Time Window Slot */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>४. {t('select_date')}</Text>
              <View style={styles.dateTabs}>
                {[
                  { label: t('today'), offset: 0 },
                  { label: t('tomorrow'), offset: 1 },
                  { label: t('day_after'), offset: 2 }
                ].map((item, idx) => {
                  const isSelected = selectedDateIndex === idx;
                  const isTodayAllClosed = item.offset === 0 && areAllTodaySlotsExpired;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.dateTab,
                        isSelected && styles.dateTabSelected,
                        isTodayAllClosed && styles.dateTabClosed
                      ]}
                      onPress={() => setSelectedDateIndex(idx)}
                    >
                      <Text
                        style={[
                          styles.dateTabText,
                          isSelected && styles.dateTabTextSelected,
                          isTodayAllClosed && styles.dateTabTextClosed
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={[
                          styles.dateTabSub,
                          isSelected && styles.dateTabSubSelected,
                          isTodayAllClosed && styles.dateTabSubClosed
                        ]}
                      >
                        {isTodayAllClosed ? 'Closed / संपले' : getSlotDateString(item.offset)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Prominent Date Confirmation Badge */}
              <View style={styles.selectedDateBadge}>
                <Text style={styles.selectedDateBadgeText}>
                  📅 {getHumanFriendlyDate(selectedDateIndex)}
                </Text>
              </View>

              {/* Warning Notice if Today is all expired */}
              {selectedDateIndex === 0 && areAllTodaySlotsExpired ? (
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeBoxText}>
                    ⚠️ {i18n.language === 'mr' ? 'आजचे सर्व आवक स्लॉट्स संपले आहेत. कृपया उद्यासाठी स्लॉट निवडा.' : "All arrival slots for today have ended. Please select tomorrow."}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.sectionLabel, { marginTop: 14 }]}>
                {t('select_time_slot')}
              </Text>
              <View style={styles.slotsList}>
                {TIME_SLOTS.map((slot, idx) => {
                  const isExpired = isSlotExpired(selectedDateIndex, slot.label);
                  const isSelected = selectedSlot === slot.label && !isExpired;
                  return (
                    <TouchableOpacity
                      key={idx}
                      disabled={isExpired}
                      style={[
                        styles.slotCard,
                        isSelected && styles.slotCardSelected,
                        isExpired && styles.slotCardDisabled
                      ]}
                      onPress={() => !isExpired && setSelectedSlot(slot.label)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.slotLeft}>
                        <Text style={styles.slotBadge}>{isExpired ? '⚪' : '🟢'}</Text>
                        <Text
                          style={[
                            styles.slotTimeText,
                            isSelected && styles.slotTimeTextSelected,
                            isExpired && styles.slotTimeTextDisabled
                          ]}
                        >
                          {slot.label}
                        </Text>
                      </View>
                      {isExpired ? (
                        <View style={styles.expiredBadge}>
                          <Text style={styles.expiredBadgeText}>
                            {i18n.language === 'mr' ? 'वेळ संपली' : i18n.language === 'hi' ? 'समय समाप्त' : 'Slot passed'}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.availableBadge}>
                          <Text style={styles.availableBadgeText}>
                            {i18n.language === 'mr' ? 'उपलब्ध' : i18n.language === 'hi' ? 'उपलब्ध' : 'Available'}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Confirm Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                isLoading && styles.submitButtonDisabled
              ]}
              onPress={handleConfirmBooking}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.submitButtonText}>
                    {' '}स्लॉट बुक होत आहे...
                  </Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>
                  🎟️ {t('confirm_booking')} →
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* AgriPool 500m Proximity Transport Match Modal */}
      <AgriPoolMatchModal
        visible={showAgriPoolModal}
        matchData={agriPoolMatch}
        onClose={() => setShowAgriPoolModal(false)}
        onViewToken={() => {
          setShowAgriPoolModal(false);
          const tok = successToken;
          setSuccessToken(null);
          navigation.navigate('TokenDetails', { token: tok });
        }}
      />

      {/* Voice Booking Interactive Modal */}
      <VoiceBookingModal
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onBookingConfirmed={handleVoiceBookingConfirmed}
        farmerName={user?.name || 'Mahesh Borde'}
        farmerPhone={user?.phone || '9876543210'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  container: {
    padding: 16,
    paddingBottom: 36
  },
  header: {
    marginBottom: 16
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted
  },
  section: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10
  },
  mandiList: {
    gap: 8
  },
  mandiOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: '#f8fafc'
  },
  mandiOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#f0fdf4'
  },
  mandiRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  mandiRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary
  },
  mandiTextCol: {
    flex: 1
  },
  mandiName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text
  },
  mandiNameSelected: {
    color: COLORS.primaryDark
  },
  mandiDistrict: {
    fontSize: 11,
    color: COLORS.textMuted
  },
  cropsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8
  },
  cropCard: {
    width: '31.5%',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cropCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#f0fdf4'
  },
  cropIcon: {
    fontSize: 22,
    marginBottom: 4
  },
  cropName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text
  },
  cropNameSelected: {
    color: COLORS.primaryDark
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  qtyInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primaryDark,
    width: 100,
    textAlign: 'center'
  },
  qtyUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted
  },
  quickQtyRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10
  },
  quickQtyChip: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  quickQtyChipSelected: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac'
  },
  quickQtyText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted
  },
  quickQtyTextSelected: {
    color: COLORS.primaryDark
  },
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  vehicleCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 10,
    borderRadius: 10,
    gap: 8
  },
  vehicleCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#f0fdf4'
  },
  vehicleIcon: {
    fontSize: 20
  },
  vehicleName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text
  },
  vehicleNameSelected: {
    color: COLORS.primaryDark
  },
  vehicleInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text
  },
  dateTabs: {
    flexDirection: 'row',
    gap: 6
  },
  dateTab: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    minHeight: 56
  },
  dateTabSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#f0fdf4'
  },
  dateTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center'
  },
  dateTabTextSelected: {
    color: COLORS.primaryDark
  },
  dateTabSub: {
    fontSize: 9.5,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center'
  },
  dateTabSubSelected: {
    color: COLORS.primaryDark
  },
  dateTabClosed: {
    opacity: 0.6,
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0'
  },
  dateTabTextClosed: {
    color: '#94a3b8'
  },
  dateTabSubClosed: {
    color: '#dc2626',
    fontWeight: '700'
  },
  selectedDateBadge: {
    backgroundColor: '#ecfdf5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignSelf: 'flex-start',
    marginTop: 10,
    marginBottom: 4
  },
  selectedDateBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark
  },
  noticeBox: {
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginTop: 8,
    marginBottom: 4
  },
  noticeBoxText: {
    fontSize: 12,
    color: '#b45309',
    fontWeight: '600'
  },
  slotsList: {
    gap: 8
  },
  slotCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: '#f8fafc',
    gap: 8
  },
  slotCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#f0fdf4'
  },
  slotCardDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    opacity: 0.55
  },
  slotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0
  },
  slotBadge: {
    fontSize: 12
  },
  slotTimeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    flexShrink: 1
  },
  slotTimeTextSelected: {
    color: COLORS.primaryDark
  },
  slotTimeTextDisabled: {
    color: '#94a3b8',
    textDecorationLine: 'line-through'
  },
  availableBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    flexShrink: 0
  },
  availableBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857'
  },
  expiredBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fca5a5',
    flexShrink: 0
  },
  expiredBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b91c1c'
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 14
  },
  errorText: {
    fontSize: 13,
    color: '#b91c1c',
    fontWeight: '700',
    textAlign: 'center'
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3
  },
  submitButtonDisabled: {
    opacity: 0.6
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  },
  successCard: {
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#86efac',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
  },
  successIcon: {
    fontSize: 48,
    marginBottom: 10
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: 4
  },
  successSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 16
  },
  tokenHighlightBox: {
    width: '100%',
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
    marginBottom: 20
  },
  tokenNumberLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2
  },
  tokenNumberValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primaryDark,
    letterSpacing: 1,
    marginBottom: 6
  },
  tokenDetailLine: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2
  },
  tokenSlotLine: {
    fontSize: 12,
    color: COLORS.textMuted
  },
  viewPassButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10
  },
  viewPassButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800'
  },
  bookAnotherButton: {
    paddingVertical: 8
  },
  bookAnotherText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600'
  },
  voiceHeroCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  voiceHeroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  voiceHeroIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  voiceBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2
  },
  voiceHeroTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803d'
  },
  aiTag: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0'
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16a34a'
  },
  voiceHeroSubtitle: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 15
  },
  voiceHeroArrow: {
    backgroundColor: '#16a34a',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center'
  },
  voiceHeroArrowText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  }
});
