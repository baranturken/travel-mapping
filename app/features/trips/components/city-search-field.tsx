import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { TravelColors } from '@/constants/theme';
import { searchWorldCities, type CityOption } from '@/features/locations/world-cities';

type ManualCityInput = {
  cityName: string;
  countryName: string;
  latitude: string;
  longitude: string;
};

type CitySearchFieldProps = {
  value: {
    cityName: string;
    countryName: string;
    latitude: string;
    longitude: string;
  };
  errorMessage?: string;
  onSelect(city: CityOption): void;
  onManualSave(city: ManualCityInput): void;
};

function isFiniteCoordinate(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed);
}

export function CitySearchField({ value, errorMessage, onSelect, onManualSave }: CitySearchFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [isManualVisible, setIsManualVisible] = useState(false);
  const [manualCityName, setManualCityName] = useState('');
  const [manualCountryName, setManualCountryName] = useState('');
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const results = useMemo(() => searchWorldCities(query), [query]);
  const selectedLabel =
    value.cityName.trim() && value.countryName.trim()
      ? `${value.cityName.trim()}, ${value.countryName.trim()}`
      : null;

  const openModal = () => {
    setQuery(selectedLabel ?? value.cityName.trim());
    setManualCityName(value.cityName);
    setManualCountryName(value.countryName);
    setManualLatitude(value.latitude);
    setManualLongitude(value.longitude);
    setManualError(null);
    setIsManualVisible(false);
    setIsVisible(true);
  };

  const closeModal = () => {
    setIsVisible(false);
  };

  const handleSelect = (city: CityOption) => {
    onSelect(city);
    setQuery(`${city.cityName}, ${city.countryName}`);
    setIsVisible(false);
  };

  const handleManualSave = () => {
    const cityName = manualCityName.trim();
    const countryName = manualCountryName.trim();
    const latitude = manualLatitude.trim();
    const longitude = manualLongitude.trim();

    if (!cityName || !countryName || !latitude || !longitude) {
      setManualError('Enter city, country, latitude, and longitude.');
      return;
    }

    if (!isFiniteCoordinate(latitude) || !isFiniteCoordinate(longitude)) {
      setManualError('Latitude and longitude must be valid numbers.');
      return;
    }

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    if (parsedLatitude < -90 || parsedLatitude > 90) {
      setManualError('Latitude must be between -90 and 90.');
      return;
    }

    if (parsedLongitude < -180 || parsedLongitude > 180) {
      setManualError('Longitude must be between -180 and 180.');
      return;
    }

    onManualSave({
      cityName,
      countryName,
      latitude,
      longitude,
    });
    setManualError(null);
    setIsVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>City</Text>

      <Pressable style={styles.selector} onPress={openModal}>
        <View style={styles.selectorTextWrap}>
          <Text style={selectedLabel ? styles.selectorValue : styles.selectorPlaceholder}>
            {selectedLabel ?? 'Search for a city'}
          </Text>
          {selectedLabel ? (
            <Text style={styles.selectorMeta}>
              {value.latitude}, {value.longitude}
            </Text>
          ) : (
            <Text style={styles.selectorMeta}>Coordinates fill automatically after selection. Manual entry stays available only as fallback.</Text>
          )}
        </View>
        <Ionicons name="search" size={18} color={TravelColors.primary} />
      </Pressable>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Modal visible={isVisible} animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select a city</Text>
            <Pressable style={styles.closeButton} onPress={closeModal}>
              <Ionicons name="close" size={18} color={TravelColors.primary} />
            </Pressable>
          </View>

          <Text style={styles.modalBody}>
            Search by city or country. Choosing a result fills the coordinates automatically.
          </Text>

          <TextInput
            autoFocus
            autoCorrect={false}
            spellCheck={false}
            autoCapitalize="words"
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search Athens, Istanbul, Tokyo..."
            placeholderTextColor={TravelColors.mutedText}
          />

          {query.trim().length < 2 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Start typing a city</Text>
              <Text style={styles.emptyBody}>Use at least 2 characters to search the bundled world city list.</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No results yet</Text>
              <Text style={styles.emptyBody}>Try a different spelling or include the country name. If the city is still missing, use the manual fallback below.</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.resultsList}
              renderItem={({ item }) => (
                <Pressable style={styles.resultCard} onPress={() => handleSelect(item)}>
                  <View style={styles.resultCopy}>
                    <Text style={styles.resultTitle}>
                      {item.cityName}, {item.countryName}
                    </Text>
                    <Text style={styles.resultMeta}>
                      {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={TravelColors.mutedText} />
                </Pressable>
              )}
            />
          )}

          <View style={styles.manualCard}>
            <Pressable style={styles.manualToggle} onPress={() => setIsManualVisible((current) => !current)}>
              <Text style={styles.manualToggleText}>Cannot find the city?</Text>
              <Ionicons
                name={isManualVisible ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={TravelColors.primary}
              />
            </Pressable>
            {isManualVisible ? (
              <View style={styles.manualFields}>
                <Text style={styles.manualBody}>
                  Use manual entry only when the search list misses your location.
                </Text>
                <TextInput
                  style={styles.searchInput}
                  value={manualCityName}
                  onChangeText={setManualCityName}
                  placeholder="City name"
                  placeholderTextColor={TravelColors.mutedText}
                />
                <TextInput
                  style={styles.searchInput}
                  value={manualCountryName}
                  onChangeText={setManualCountryName}
                  placeholder="Country name"
                  placeholderTextColor={TravelColors.mutedText}
                />
                <TextInput
                  style={styles.searchInput}
                  value={manualLatitude}
                  onChangeText={setManualLatitude}
                  placeholder="Latitude"
                  placeholderTextColor={TravelColors.mutedText}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={styles.searchInput}
                  value={manualLongitude}
                  onChangeText={setManualLongitude}
                  placeholder="Longitude"
                  placeholderTextColor={TravelColors.mutedText}
                  keyboardType="decimal-pad"
                />
                {manualError ? <Text style={styles.errorText}>{manualError}</Text> : null}
                <Pressable style={styles.manualSaveButton} onPress={handleManualSave}>
                  <Text style={styles.manualSaveButtonText}>Use manual city</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    color: TravelColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  selector: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectorTextWrap: {
    flex: 1,
    gap: 4,
  },
  selectorValue: {
    color: TravelColors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  selectorPlaceholder: {
    color: TravelColors.mutedText,
    fontSize: 15,
  },
  selectorMeta: {
    color: TravelColors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: TravelColors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: TravelColors.background,
    paddingTop: 72,
    paddingHorizontal: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: {
    color: TravelColors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TravelColors.tintSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    color: TravelColors.secondaryText,
    fontSize: 14,
    lineHeight: 22,
  },
  searchInput: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: TravelColors.text,
    fontSize: 16,
  },
  resultsList: {
    paddingBottom: 8,
    gap: 10,
  },
  resultCard: {
    backgroundColor: TravelColors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: TravelColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultCopy: {
    flex: 1,
    gap: 4,
  },
  resultTitle: {
    color: TravelColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  resultMeta: {
    color: TravelColors.secondaryText,
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
  },
  emptyTitle: {
    color: TravelColors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyBody: {
    color: TravelColors.secondaryText,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  manualCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: TravelColors.border,
    backgroundColor: TravelColors.surface,
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  manualToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  manualToggleText: {
    color: TravelColors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  manualFields: {
    gap: 10,
  },
  manualBody: {
    color: TravelColors.secondaryText,
    fontSize: 13,
    lineHeight: 20,
  },
  manualSaveButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: TravelColors.primary,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  manualSaveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});

