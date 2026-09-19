import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Dimensions
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useTranslation } from 'react-i18next';
import client from '../../api/client';
import { Storage } from '../../utils/storage';
import { COLORS } from '../../utils/constants';

const { width } = Dimensions.get('window');

const DISTRICTS = ['All', 'Ahilyanagar', 'Nashik', 'Pune', 'Chhatrapati Sambhajinagar'];

const DEFAULT_CENTRES = [
  {
    _id: '65f1a2b3c4d5e6f7a8b9c0d1',
    code: 'KPG-01',
    name: 'APMC Kopargaon',
    nameMarathi: 'कोपरगाव कृषी उत्पन्न बाजार समिती',
    district: 'Ahilyanagar',
    locationName: 'Kopargaon, Ahilyanagar',
    location: { coordinates: [74.4829, 19.8370] },
    cropsHandled: ['Wheat', 'Soybean', 'Onion', 'Cotton'],
    workingHours: { start: '08:00', end: '18:00' },
    currentStatus: 'Green',
    activeBookingsCount: 8,
    totalCapacity: 100,
    utilizationPercent: 8
  },
  {
    _id: '65f1a2b3c4d5e6f7a8b9c0d2',
    code: 'RHT-01',
    name: 'APMC Rahata',
    nameMarathi: 'राहाता कृषी उत्पन्न बाजार समिती',
    district: 'Ahilyanagar',
    locationName: 'Rahata, Ahilyanagar',
    location: { coordinates: [74.4985, 19.6980] },
    cropsHandled: ['Soybean', 'Onion', 'Maize', 'Pomegranate'],
    workingHours: { start: '08:30', end: '17:30' },
    currentStatus: 'Yellow',
    activeBookingsCount: 42,
    totalCapacity: 80,
    utilizationPercent: 52
  },
  {
    _id: '65f1a2b3c4d5e6f7a8b9c0d3',
    code: 'SHR-01',
    name: 'APMC Shirdi Sub-Yard',
    nameMarathi: 'शिर्डी उपबाजार समिती',
    district: 'Ahilyanagar',
    locationName: 'Shirdi, Ahilyanagar',
    location: { coordinates: [74.4762, 19.7645] },
    cropsHandled: ['Flowers', 'Vegetables', 'Wheat'],
    workingHours: { start: '07:00', end: '19:00' },
    currentStatus: 'Green',
    activeBookingsCount: 15,
    totalCapacity: 90,
    utilizationPercent: 16
  },
  {
    _id: '65f1a2b3c4d5e6f7a8b9c0d4',
    code: 'NSK-01',
    name: 'APMC Lasalgaon (Nashik)',
    nameMarathi: 'लासलगाव मुख्य कांदा बाजार समिती',
    district: 'Nashik',
    locationName: 'Lasalgaon, Nashik',
    location: { coordinates: [74.2289, 20.1472] },
    cropsHandled: ['Onion', 'Soybean', 'Wheat', 'Maize'],
    workingHours: { start: '08:00', end: '18:00' },
    currentStatus: 'Red',
    activeBookingsCount: 88,
    totalCapacity: 100,
    utilizationPercent: 88
  }
];

export default function CentresScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const [centres, setCentres] = useState(DEFAULT_CENTRES);
  const [selectedDistrict, setSelectedDistrict] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCentre, setSelectedCentre] = useState(null);

  const fetchCentres = useCallback(async () => {
    try {
      const res = await client.get('/centres');
      const data = res.data?.data || res.data || [];
      if (Array.isArray(data) && data.length > 0) {
        setCentres(data);
        await Storage.setJson(Storage.ASYNC_KEYS.CENTRES, data);
      }
    } catch (error) {
      console.warn('[CentresScreen] Fetch error:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCentres();
  }, [fetchCentres]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCentres();
  };

  const filteredCentres = useMemo(() => {
    return centres.filter((c) => {
      const matchDistrict =
        selectedDistrict === 'All' ||
        (c.district &&
          c.district.toLowerCase() === selectedDistrict.toLowerCase());

      const query = searchQuery.toLowerCase().trim();
      const matchQuery =
        !query ||
        (c.name && c.name.toLowerCase().includes(query)) ||
        (c.nameMarathi && c.nameMarathi.includes(query)) ||
        (c.district && c.district.toLowerCase().includes(query)) ||
        (c.cropsHandled &&
          c.cropsHandled.some((crop) => crop.toLowerCase().includes(query)));

      return matchDistrict && matchQuery;
    });
  }, [centres, selectedDistrict, searchQuery]);

  const getCongestionBadge = (status, util) => {
    const s = (status || '').toLowerCase();
    const u = Number(util) || 0;

    // Backend currentStatus enum: 'Green' (<70%), 'Amber' (70-90%), 'Red' (>90%)
    if (s === 'red' || u > 90) {
      return {
        label: t('congestion_high'),
        color: '#dc2626',
        bg: '#fee2e2',
        dot: '🔴'
      };
    }
    if (s === 'amber' || s === 'yellow' || (u >= 70 && u <= 90)) {
      return {
        label: t('congestion_medium'),
        color: '#d97706',
        bg: '#fef3c7',
        dot: '🟡'
      };
    }
    return {
      label: t('congestion_low'),
      color: '#16a34a',
      bg: '#dcfce7',
      dot: '🟢'
    };
  };

  const handleBookAtCentre = (centre) => {
    navigation.navigate('HomeTab', {
      screen: 'Book',
      params: { preselectedMandi: centre }
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.container}>
        {/* Header Title & View Toggle */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>📍 {t('centres_title')}</Text>

          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                viewMode === 'list' && styles.toggleButtonActive
              ]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={[
                  styles.toggleText,
                  viewMode === 'list' && styles.toggleTextActive
                ]}
              >
                📋 {t('list_view')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleButton,
                viewMode === 'map' && styles.toggleButtonActive
              ]}
              onPress={() => setViewMode('map')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={[
                  styles.toggleText,
                  viewMode === 'map' && styles.toggleTextActive
                ]}
              >
                🗺️ {t('map_view')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('search_centres_placeholder')}
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* District Filter Chips */}
        <View style={styles.districtChipsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.districtChips}
          >
            {DISTRICTS.map((dist) => {
              const isSelected = selectedDistrict === dist;
              return (
                <TouchableOpacity
                  key={dist}
                  style={[
                    styles.districtChip,
                    isSelected && styles.districtChipSelected
                  ]}
                  onPress={() => setSelectedDistrict(dist)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.districtChipText,
                      isSelected && styles.districtChipTextSelected
                    ]}
                  >
                    {dist === 'All' ? t('filter_all') : dist}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Main Content: List or Map View */}
        {viewMode === 'list' ? (
          <FlatList
            data={filteredCentres}
            keyExtractor={(item) => item._id || item.code}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const badge = getCongestionBadge(
                item.currentStatus,
                item.utilizationPercent
              );
              return (
                <View style={styles.centreCard}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.nameBlock}>
                      <Text style={styles.centreCodeBadge}>{item.code}</Text>
                      <Text style={styles.centreName}>
                        {i18n.language === 'mr' && item.nameMarathi
                          ? item.nameMarathi
                          : item.name}
                      </Text>
                      <Text style={styles.centreLocation}>
                        📍 {item.locationName || item.district}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.congestionPill,
                        { backgroundColor: badge.bg }
                      ]}
                    >
                      <Text
                        style={[
                          styles.congestionPillText,
                          { color: badge.color }
                        ]}
                      >
                        {badge.dot} {badge.label}
                      </Text>
                    </View>
                  </View>

                  {/* Timing & Capacity Info */}
                  <View style={styles.infoRow}>
                    <Text style={styles.infoText}>
                      ⏱ {item.workingHours?.start || '08:00'} - {item.workingHours?.end || '18:00'}
                    </Text>
                    <Text style={styles.infoText}>
                      🚦 Capacity: {item.activeBookingsCount || 0}/{item.totalCapacity || 100} Slots
                    </Text>
                  </View>

                  {/* Crops Handled */}
                  {Array.isArray(item.cropsHandled) && item.cropsHandled.length > 0 && (
                    <View style={styles.cropsRow}>
                      <Text style={styles.cropsLabel}>{t('crops_handled')}:</Text>
                      <View style={styles.cropPills}>
                        {item.cropsHandled.map((crop, idx) => (
                          <View key={idx} style={styles.cropPill}>
                            <Text style={styles.cropPillText}>{crop}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Book Button Action */}
                  <TouchableOpacity
                    style={styles.bookButton}
                    onPress={() => handleBookAtCentre(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.bookButtonText}>
                      📅 {t('book_at_mandi')} →
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {loading ? 'मंडी केंद्र लोड होत आहेत...' : 'कोणतीही बाजार समिती सापडली नाही.'}
                </Text>
              </View>
            }
          />
        ) : (
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: 19.8370,
                longitude: 74.4829,
                latitudeDelta: 0.8,
                longitudeDelta: 0.8
              }}
            >
              {filteredCentres.map((c) => {
                const coords = c.location?.coordinates;
                const lng = Array.isArray(coords) && isFinite(Number(coords[0])) ? Number(coords[0]) : 74.4829;
                const lat = Array.isArray(coords) && isFinite(Number(coords[1])) ? Number(coords[1]) : 19.8370;
                const badge = getCongestionBadge(
                  c.currentStatus,
                  c.utilizationPercent
                );
                return (
                  <Marker
                    key={c._id || c.code}
                    coordinate={{ latitude: lat, longitude: lng }}
                    title={c.name}
                    description={`${badge.label} · ${c.district}`}
                    pinColor={badge.color}
                    onPress={() => setSelectedCentre(c)}
                  >
                    <Callout onPress={() => handleBookAtCentre(c)}>
                      <View style={styles.calloutBox}>
                        <Text style={styles.calloutTitle}>{c.name}</Text>
                        <Text style={styles.calloutSub}>
                          {badge.dot} {badge.label} · {c.district}
                        </Text>
                        <Text style={styles.calloutAction}>
                          👉 {t('book_at_mandi')}
                        </Text>
                      </View>
                    </Callout>
                  </Marker>
                );
              })}
            </MapView>

            {/* Bottom Preview Card for Selected Map Marker */}
            {selectedCentre && (
              <View style={styles.mapSelectedCard}>
                <View style={styles.mapSelectedHeader}>
                  <View style={styles.mapSelectedNameBlock}>
                    <Text style={styles.mapSelectedTitle}>
                      {selectedCentre.name}
                    </Text>
                    <Text style={styles.mapSelectedSub}>
                      📍 {selectedCentre.locationName || selectedCentre.district}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.mapCloseBtn}
                    onPress={() => setSelectedCentre(null)}
                  >
                    <Text style={styles.mapCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.mapBookButton}
                  onPress={() => handleBookAtCentre(selectedCentre)}
                >
                  <Text style={styles.mapBookButtonText}>
                    📅 {t('book_at_mandi')} →
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  container: {
    flex: 1
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primaryDark,
    flex: 1,
    flexShrink: 1
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 2,
    flexShrink: 0
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6
  },
  toggleButtonActive: {
    backgroundColor: COLORS.surface,
    elevation: 2
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted
  },
  toggleTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '800'
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginVertical: 6
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: COLORS.text
  },
  districtChipsWrapper: {
    paddingVertical: 6
  },
  districtChips: {
    paddingHorizontal: 16,
    gap: 8
  },
  districtChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16
  },
  districtChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  districtChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted
  },
  districtChipTextSelected: {
    color: '#ffffff',
    fontWeight: '800'
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12
  },
  centreCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8
  },
  nameBlock: {
    flex: 1,
    minWidth: 0
  },
  centreCodeBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: 2
  },
  centreName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2
  },
  centreLocation: {
    fontSize: 12,
    color: COLORS.textMuted
  },
  congestionPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    flexShrink: 0,
    alignSelf: 'flex-start'
  },
  congestionPillText: {
    fontSize: 11,
    fontWeight: '800'
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600'
  },
  cropsRow: {
    marginBottom: 12
  },
  cropsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 4
  },
  cropPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  cropPill: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  cropPillText: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '600'
  },
  bookButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bookButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden'
  },
  map: {
    ...StyleSheet.absoluteFillObject
  },
  calloutBox: {
    padding: 8,
    width: 200
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2
  },
  calloutSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4
  },
  calloutAction: {
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: '800'
  },
  mapSelectedCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6
  },
  mapSelectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  mapSelectedNameBlock: {
    flex: 1
  },
  mapSelectedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text
  },
  mapSelectedSub: {
    fontSize: 12,
    color: COLORS.textMuted
  },
  mapCloseBtn: {
    padding: 4
  },
  mapCloseText: {
    fontSize: 16,
    color: COLORS.textMuted,
    fontWeight: '700'
  },
  mapBookButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  mapBookButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted
  }
});
