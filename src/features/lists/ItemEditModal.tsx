import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import type { Item } from '../../data';
import { CATEGORIES } from '../../core/categories';
import { CANETO_API } from '../../core/api';
import { applyPriceKey, finalizePriceEntry, formatPriceEntry, priceToDigits, validEan } from '../../core/priceEntry';
import { CanetoIcon } from '../../ui/CanetoIcon';
import { createThemedStyles, theme } from '../../ui/theme';

export type ItemChanges = {
  name: string;
  quantity: number;
  unit: string;
  price: number | null;
  category_id: string;
  ean: string | null;
  brand: string | null;
  photo_url?: string | null;
  label_photo_url?: string | null;
};

export interface ItemEditModalProps {
  item: Item | null;
  visible: boolean;
  isCompleted?: boolean;
  onClose: () => void;
  onSave: (changes: ItemChanges) => Promise<void>;
  onDelete: () => Promise<void>;
}

const UNITS = ['un', 'kg', 'g', 'L', 'ml', 'pct', 'cx', 'dz', 'lata', 'garrafa'] as const;

export function ItemEditModal(props: ItemEditModalProps) {
  if (!props.visible || !props.item) return null;
  return <ItemEditDialog key={props.item.id} {...props} item={props.item} />;
}

function ItemEditDialog({
  item,
  isCompleted = false,
  onClose,
  onSave,
  onDelete,
}: Omit<ItemEditModalProps, 'visible' | 'item'> & { item: Item }) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit || 'un');
  const [price, setPrice] = useState(item.price != null ? String(item.price).replace('.', ',') : '');
  const [category, setCategory] = useState(item.category_id || 'outros');
  const [ean, setEan] = useState(item.ean || '');
  const [brand, setBrand] = useState(item.brand || '');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(item.photo_url || null);
  const [labelPhoto, setLabelPhoto] = useState<string | null>(item.label_photo_url || null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [scanToast, setScanToast] = useState<string | null>(null);

  // Keypad
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [keypadMode, setKeypadMode] = useState<'price' | 'barcode'>('price');
  const [keypadDigits, setKeypadDigits] = useState('');
  const [barcodeDigits, setBarcodeDigits] = useState('');

  // Scanners / Previews
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [isLabelPreviewOpen, setIsLabelPreviewOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const numericPrice = price.trim() ? Number(price.replace(',', '.')) : null;

  const showToast = (text: string) => {
    setScanToast(text);
    setTimeout(() => setScanToast(null), 3500);
  };

  const handlePickPhoto = () => {
    if (isCompleted) return;
    Alert.alert('Foto do produto', 'Selecione uma opção:', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Tirar foto',
        onPress: async () => {
          const res = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true });
          if (!res.canceled && res.assets[0]?.uri) {
            setPreviewPhoto(res.assets[0].uri);
          }
        },
      },
      {
        text: 'Escolher da galeria',
        onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
          if (!res.canceled && res.assets[0]?.uri) {
            setPreviewPhoto(res.assets[0].uri);
          }
        },
      },
    ]);
  };

  const handleCaptureLabelPhoto = () => {
    if (isCompleted) return;
    Alert.alert('Etiqueta de preço', 'Fotografar etiqueta:', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Tirar foto da etiqueta',
        onPress: async () => {
          const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
          if (!res.canceled && res.assets[0]?.uri) {
            setLabelPhoto(res.assets[0].uri);
            showToast('Etiqueta capturada!');
          }
        },
      },
      {
        text: 'Escolher da galeria',
        onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
          if (!res.canceled && res.assets[0]?.uri) {
            setLabelPhoto(res.assets[0].uri);
            showToast('Etiqueta capturada!');
          }
        },
      },
    ]);
  };

  const handleKeypadPress = (key: string) => {
    if (keypadMode === 'barcode') {
      if (key === 'C') setBarcodeDigits('');
      else if (key === '⌫') setBarcodeDigits(cur => cur.slice(0, -1));
      else setBarcodeDigits(cur => `${cur}${key}`.slice(0, 14));
      return;
    }
    setKeypadDigits(cur => applyPriceKey(cur, key));
  };

  const openKeypad = (mode: 'price' | 'barcode') => {
    if (isCompleted) return;
    setKeypadMode(mode);
    if (mode === 'price') {
      setKeypadDigits(priceToDigits(price));
    } else {
      setBarcodeDigits(ean);
    }
    setIsKeypadOpen(true);
  };

  const confirmKeypad = () => {
    if (keypadMode === 'price') {
      setPrice(finalizePriceEntry(keypadDigits));
    } else {
      setEan(barcodeDigits.trim());
      if (validEan(barcodeDigits.trim())) {
        void fetchProductDetails(barcodeDigits.trim());
      }
    }
    setIsKeypadOpen(false);
  };

  const openBarcodeScanner = async () => {
    if (isCompleted) return;
    if (!permission?.granted) {
      const grant = await requestPermission();
      if (!grant.granted) {
        Alert.alert('Permissão necessária', 'Permita o acesso à câmera para ler o código de barras.');
        return;
      }
    }
    setIsKeypadOpen(false);
    setIsBarcodeScannerOpen(true);
  };

  const fetchProductDetails = async (code: string) => {
    const trimmed = code.trim();
    if (!validEan(trimmed)) return;
    setLoadingDetails(true);
    setMessage('');
    try {
      const res = await fetch(`${CANETO_API}/api/products/scan?ean=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json() as { product?: { name?: string; brand?: string; categoryId?: string; photoUrl?: string; image?: string } };
        const product = data?.product;
        if (product) {
          if (!name.trim() && product.name) setName(product.name);
          if (!brand.trim() && product.brand) setBrand(product.brand);
          if (product.categoryId && CATEGORIES[product.categoryId]) setCategory(product.categoryId);
          if (!previewPhoto && (product.photoUrl || product.image)) setPreviewPhoto(product.photoUrl || product.image || null);
          showToast('Produto identificado!');
        } else {
          setMessage('Nenhum detalhe extra encontrado para este EAN.');
        }
      } else {
        setMessage('Código não encontrado na base de produtos.');
      }
    } catch {
      setMessage('Não foi possível consultar os detalhes agora.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const save = async () => {
    if (isCompleted) {
      onClose();
      return;
    }
    const parsedQuantity = Number(quantity.replace(',', '.'));
    if (!name.trim() || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || (numericPrice !== null && !Number.isFinite(numericPrice))) {
      setMessage('Confira nome, quantidade e preço antes de salvar.');
      return;
    }
    try {
      setBusy(true);
      setMessage('');
      await onSave({
        name: name.trim(),
        quantity: parsedQuantity,
        unit,
        price: numericPrice,
        category_id: category,
        ean: ean.trim() || null,
        brand: brand.trim() || null,
        photo_url: previewPhoto,
        label_photo_url: labelPhoto,
      });
      onClose();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Não foi possível salvar o produto.');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    Alert.alert('Excluir produto?', item.name, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => void onDelete().then(onClose) },
    ]);
  };

  const isEanClean = ean.trim();
  const isEanValid = validEan(isEanClean);
  const eanSummary = !isEanClean ? 'Sem EAN · escaneie' : isEanValid ? 'Verificar EAN' : 'Confira o EAN';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom', 'left', 'right']}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar janela" />

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="create-outline" size={20} color={theme.blue} />
            </View>
            <View style={styles.heading}>
              <Text style={styles.title} numberOfLines={1}>Editar produto</Text>
              <Text style={styles.subtitle} numberOfLines={1}>Revise as informações do item</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Fechar janela">
              <Ionicons name="close" size={22} color={theme.muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Banner de lista finalizada com nota fiscal */}
            {isCompleted && (
              <View style={styles.completedBanner}>
                <Ionicons name="checkmark-circle" size={17} color={theme.success} />
                <Text style={styles.completedBannerText}>Compra finalizada com nota fiscal. Informações em modo de visualização.</Text>
              </View>
            )}

            {/* 📸 1. SEÇÃO DE FOTO DO PRODUTO (Square 1:1) */}
            <View style={styles.photoContainer}>
              <View style={styles.photoFrame}>
                {previewPhoto ? (
                  <Image source={{ uri: previewPhoto }} style={styles.photoImage} resizeMode="cover" />
                ) : (
                  <View style={styles.photoFallback}>
                    <CanetoIcon name={category || 'package'} size={46} color={theme.blue} />
                  </View>
                )}

                {!isCompleted && (
                  <View style={styles.photoOverlayActions}>
                    <Pressable style={styles.photoActionBtn} onPress={handlePickPhoto}>
                      <Ionicons name="camera-outline" size={16} color={theme.blue} />
                      <Text style={styles.photoActionText}>{previewPhoto ? 'Trocar foto' : 'Adicionar foto'}</Text>
                    </Pressable>
                    {!!previewPhoto && (
                      <Pressable style={styles.photoRemoveBtn} onPress={() => setPreviewPhoto(null)}>
                        <Ionicons name="trash-outline" size={15} color={theme.danger} />
                        <Text style={styles.photoRemoveText}>Remover</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* 🏷️ Nome do Produto */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Produto</Text>
              <TextInput
                style={[styles.input, styles.productInput]}
                value={name}
                onChangeText={setName}
                placeholder="Nome do produto"
                placeholderTextColor={theme.placeholder}
                editable={!isCompleted}
              />
            </View>

            {/* 🔢 QUANTIDADE & UNIDADE (2 Colunas) */}
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Qtd.</Text>
                <View style={styles.stepperContainer}>
                  <Pressable
                    style={styles.stepperButton}
                    disabled={isCompleted}
                    onPress={() => {
                      const cur = Number(quantity.replace(',', '.')) || 1;
                      setQuantity(String(Math.max(1, cur - 1)));
                    }}
                  >
                    <Ionicons name="remove" size={18} color={theme.ink} />
                  </Pressable>
                  <TextInput
                    style={styles.stepperInput}
                    keyboardType="decimal-pad"
                    value={quantity}
                    onChangeText={setQuantity}
                    editable={!isCompleted}
                  />
                  <Pressable
                    style={styles.stepperButton}
                    disabled={isCompleted}
                    onPress={() => {
                      const cur = Number(quantity.replace(',', '.')) || 0;
                      setQuantity(String(cur + 1));
                    }}
                  >
                    <Ionicons name="add" size={18} color={theme.ink} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.col}>
                <Text style={styles.label}>Unidade</Text>
                <Pressable
                  style={styles.unitDropdown}
                  disabled={isCompleted}
                  onPress={() => setUnitPickerOpen(true)}
                >
                  <Text style={styles.unitDropdownText}>{unit}</Text>
                  <Ionicons name="chevron-down" size={16} color={theme.muted} />
                </Pressable>
              </View>
            </View>

            {/* 💰 Preço em destaque com leitura de etiqueta e calculadora */}
            <View style={styles.formGroup}>
              <View style={styles.labelWithToast}>
                <Text style={styles.label}>Preço</Text>
                {!!scanToast && <Text style={styles.scanToastText}>{scanToast}</Text>}
              </View>
              <View style={styles.priceContainer}>
                <Pressable style={styles.priceTouchable} onPress={() => openKeypad('price')}>
                  <Text style={styles.priceValueText}>{price ? `R$ ${price}` : '0,00'}</Text>
                </Pressable>

                {/* Botão Calculadora */}
                <Pressable
                  style={styles.calculatorButton}
                  onPress={() => openKeypad('price')}
                  disabled={isCompleted}
                  accessibilityLabel="Abrir teclado numérico"
                >
                  <Ionicons name="calculator-outline" size={17} color={theme.blue} />
                </Pressable>

                {/* Miniatura ou Botão Câmera Etiqueta */}
                {labelPhoto ? (
                  <Pressable style={styles.labelThumbnail} onPress={() => setIsLabelPreviewOpen(true)}>
                    <Image source={{ uri: labelPhoto }} style={styles.thumbnailImage} />
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.cameraLabelButton}
                    onPress={handleCaptureLabelPhoto}
                    disabled={isCompleted}
                    accessibilityLabel="Capturar etiqueta de preço"
                  >
                    <Ionicons name="camera" size={18} color="#FFFFFF" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* 🔽 Mais detalhes do produto (Accordion) */}
            <View style={styles.accordionContainer}>
              <Pressable
                style={styles.accordionHeader}
                onPress={() => setDetailsOpen(v => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: detailsOpen }}
              >
                <Text style={styles.accordionTitle}>Mais detalhes do produto</Text>
                <View style={styles.accordionSubtitleWrap}>
                  <Text style={styles.accordionSubtitle}>{eanSummary}</Text>
                  <Text style={styles.accordionPlus}>{detailsOpen ? '−' : '+'}</Text>
                </View>
              </Pressable>

              {detailsOpen && (
                <View style={styles.accordionBody}>
                  {/* Categoria */}
                  <View style={styles.detailsGroup}>
                    <Text style={styles.subLabel}>Categoria</Text>
                    <View style={styles.categoryGrid}>
                      {Object.values(CATEGORIES).map(cat => {
                        const active = category === cat.id;
                        return (
                          <Pressable
                            key={cat.id}
                            style={[styles.categoryChip, active && styles.categoryChipActive]}
                            onPress={() => !isCompleted && setCategory(cat.id)}
                            disabled={isCompleted}
                          >
                            <CanetoIcon name={cat.id} size={15} color={active ? '#FFFFFF' : theme.blue} />
                            <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                              {cat.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Código de barras & Marca */}
                  <View style={styles.formGroup}>
                    <View style={styles.fieldTitleRow}>
                      <Ionicons name="barcode-outline" size={14} color={theme.blue} />
                      <Text style={styles.subLabel}>Código de barras</Text>
                    </View>
                    <View style={styles.barcodeField}>
                      <Pressable style={styles.barcodeTouchable} onPress={() => openKeypad('barcode')}>
                        <Text style={[styles.barcodeText, !ean && styles.barcodePlaceholder]}>
                          {ean || 'Digitar código'}
                        </Text>
                      </Pressable>
                      <Pressable style={styles.barcodeCalcBtn} onPress={() => openKeypad('barcode')}>
                        <Ionicons name="calculator-outline" size={17} color={theme.blue} />
                      </Pressable>
                      <Pressable style={styles.barcodeScanBtn} onPress={() => void openBarcodeScanner()}>
                        <Ionicons name="barcode-outline" size={18} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <View style={styles.fieldTitleRow}>
                      <Ionicons name="pricetag-outline" size={14} color={theme.blue} />
                      <Text style={styles.subLabel}>Marca</Text>
                    </View>
                    <TextInput
                      style={styles.input}
                      value={brand}
                      onChangeText={setBrand}
                      placeholder="ex: Elma Chips, Lacta..."
                      placeholderTextColor={theme.placeholder}
                      editable={!isCompleted}
                    />
                  </View>

                  {/* Mensagem descritiva do EAN */}
                  <Text style={styles.eanHelperText}>
                    {!isEanClean
                      ? 'Escaneie ou digite o código de barras para consultar os detalhes do produto.'
                      : isEanValid
                        ? 'Código de barras com formato válido pronto para consulta.'
                        : 'Confira o código de barras: use um EAN válido com 8 ou 13 dígitos.'}
                  </Text>

                  {/* Botão Consultar Detalhes */}
                  <Pressable
                    style={[styles.consultButton, (!isEanValid || loadingDetails || isCompleted) && styles.disabled]}
                    disabled={!isEanValid || loadingDetails || isCompleted}
                    onPress={() => void fetchProductDetails(ean)}
                  >
                    {loadingDetails ? (
                      <ActivityIndicator size="small" color={theme.blue} />
                    ) : (
                      <Text style={styles.consultButtonText}>Consultar detalhes do produto</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>

            {!!message && <Text style={styles.errorMessage}>{message}</Text>}
          </ScrollView>

          {/* Rodapé fixo */}
          <View style={styles.footer}>
            {isCompleted ? (
              <View style={styles.completedFooter}>
                <Text style={styles.completedFooterText}>Lista finalizada (somente leitura)</Text>
                <Pressable style={styles.primaryButton} onPress={onClose}>
                  <Text style={styles.primaryButtonText}>Fechar</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.actionsFooter}>
                <Pressable style={styles.deleteButton} onPress={remove} disabled={busy}>
                  <Ionicons name="trash-outline" size={16} color={theme.danger} />
                  <Text style={styles.deleteButtonText}>Excluir</Text>
                </Pressable>
                <Pressable style={[styles.saveButton, busy && styles.disabled]} onPress={() => void save()} disabled={busy}>
                  <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>{busy ? 'Salvando...' : 'Salvar'}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* ======================================================== */}
        {/* 🔢 MODAL TECLADO NUMÉRICO (BRL & EAN) */}
        {/* ======================================================== */}
        {isKeypadOpen && (
          <Modal transparent animationType="fade" visible={isKeypadOpen} onRequestClose={() => setIsKeypadOpen(false)}>
            <View style={styles.keypadOverlay}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsKeypadOpen(false)} />
              <View style={styles.keypadCard}>
                <View style={styles.keypadHeader}>
                  <Text style={styles.keypadModeTitle}>
                    {keypadMode === 'price' ? 'Preço (R$)' : 'Código de barras'}
                  </Text>
                  <Text style={styles.keypadDisplayValue}>
                    {keypadMode === 'price' ? `R$ ${formatPriceEntry(keypadDigits)}` : (barcodeDigits || 'EAN-8 ou EAN-13')}
                  </Text>
                </View>

                {/* Grade 3x4 */}
                <View style={styles.keypadGrid}>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '00'].map(k => (
                    <Pressable key={k} style={styles.keypadKey} onPress={() => handleKeypadPress(k)}>
                      <Text style={styles.keypadKeyText}>{k}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Botões Limpar e Ação Rápida */}
                <View style={styles.keypadExtraActions}>
                  <Pressable style={styles.keypadClearBtn} onPress={() => handleKeypadPress('C')}>
                    <Text style={styles.keypadClearText}>Limpar (C)</Text>
                  </Pressable>
                  <Pressable
                    style={styles.keypadCameraBtn}
                    onPress={() => {
                      if (keypadMode === 'price') {
                        setIsKeypadOpen(false);
                        handleCaptureLabelPhoto();
                      } else {
                        void openBarcodeScanner();
                      }
                    }}
                  >
                    <Ionicons name={keypadMode === 'price' ? 'camera-outline' : 'barcode-outline'} size={17} color={theme.blue} />
                    <Text style={styles.keypadCameraText}>
                      {keypadMode === 'price' ? 'Capturar Etiqueta' : 'Escanear código'}
                    </Text>
                  </Pressable>
                </View>

                {/* Cancelar e Concluir */}
                <View style={styles.keypadBottomRow}>
                  <Pressable style={styles.keypadCancelBtn} onPress={() => setIsKeypadOpen(false)}>
                    <Text style={styles.keypadCancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.keypadConfirmBtn,
                      keypadMode === 'barcode' && barcodeDigits.length > 0 && !validEan(barcodeDigits) && styles.disabled,
                    ]}
                    onPress={confirmKeypad}
                  >
                    <Text style={styles.keypadConfirmText}>Concluir</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* ======================================================== */}
        {/* 📷 MODAL BARCODE SCANNER RÁPIDO COM CAMERA */}
        {/* ======================================================== */}
        {isBarcodeScannerOpen && (
          <Modal transparent animationType="slide" visible={isBarcodeScannerOpen} onRequestClose={() => setIsBarcodeScannerOpen(false)}>
            <SafeAreaView style={styles.scannerModalOverlay}>
              <View style={styles.scannerHeader}>
                <Text style={styles.scannerTitle}>Escanear código de barras</Text>
                <Pressable style={styles.scannerClose} onPress={() => setIsBarcodeScannerOpen(false)}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </Pressable>
              </View>
              <View style={styles.cameraBox}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
                  }}
                  onBarcodeScanned={result => {
                    const scanned = result.data?.trim();
                    if (scanned) {
                      setEan(scanned);
                      setIsBarcodeScannerOpen(false);
                      showToast(`EAN lido: ${scanned}`);
                      void fetchProductDetails(scanned);
                    }
                  }}
                />
                <View style={styles.scannerTargetBox} />
              </View>
              <Text style={styles.scannerHint}>Centralize a linha no código de barras do produto</Text>
            </SafeAreaView>
          </Modal>
        )}

        {/* ======================================================== */}
        {/* 🖼️ MODAL PREVIEW DA FOTO DA ETIQUETA */}
        {/* ======================================================== */}
        {isLabelPreviewOpen && labelPhoto && (
          <Modal transparent animationType="fade" visible={isLabelPreviewOpen} onRequestClose={() => setIsLabelPreviewOpen(false)}>
            <View style={styles.labelPreviewOverlay}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsLabelPreviewOpen(false)} />
              <View style={styles.labelPreviewCard}>
                <View style={styles.labelPreviewHeader}>
                  <Text style={styles.labelPreviewTitle}>Foto da etiqueta de preço</Text>
                  <Pressable onPress={() => setIsLabelPreviewOpen(false)}>
                    <Ionicons name="close" size={22} color={theme.ink} />
                  </Pressable>
                </View>
                <Image source={{ uri: labelPhoto }} style={styles.labelPreviewImage} resizeMode="contain" />
                <View style={styles.labelPreviewFooter}>
                  <Pressable
                    style={styles.labelRemoveBtn}
                    onPress={() => {
                      setLabelPhoto(null);
                      setIsLabelPreviewOpen(false);
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.danger} />
                    <Text style={styles.labelRemoveText}>Remover foto da etiqueta</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* ======================================================== */}
        {/* 📦 MODAL SELETOR DE UNIDADE */}
        {/* ======================================================== */}
        {unitPickerOpen && (
          <Modal transparent animationType="fade" visible={unitPickerOpen} onRequestClose={() => setUnitPickerOpen(false)}>
            <View style={styles.keypadOverlay}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setUnitPickerOpen(false)} />
              <View style={styles.unitPickerCard}>
                <Text style={styles.unitPickerTitle}>Selecione a Unidade</Text>
                <View style={styles.unitGrid}>
                  {UNITS.map(u => (
                    <Pressable
                      key={u}
                      style={[styles.unitChip, unit === u && styles.unitChipActive]}
                      onPress={() => {
                        setUnit(u);
                        setUnitPickerOpen(false);
                      }}
                    >
                      <Text style={[styles.unitChipText, unit === u && styles.unitChipTextActive]}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = createThemedStyles(theme => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.dialog.backdrop,
    justifyContent: 'center',
    paddingHorizontal: theme.dialog.horizontalMargin,
    paddingVertical: 12,
  },
  sheet: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.xxl,
    maxHeight: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
    maxWidth: theme.dialog.maxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: theme.border,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.blueSoft,
    borderWidth: 1,
    borderColor: theme.border,
  },
  heading: { flex: 1, paddingRight: 6 },
  title: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 18, lineHeight: 24 },
  subtitle: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 13, lineHeight: 18 },
  closeButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, paddingBottom: 18, gap: 12 },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: theme.successSoft,
    borderWidth: 1,
    borderColor: theme.success,
  },
  completedBannerText: {
    flex: 1,
    color: theme.success,
    fontFamily: theme.font.semibold,
    fontSize: 12,
    lineHeight: 17,
  },
  photoContainer: {
    width: '100%',
    alignItems: 'center',
  },
  photoFrame: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceMuted,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoImage: { width: '100%', height: '100%' },
  photoFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceMuted,
  },
  photoOverlayActions: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  photoActionBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  photoActionText: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 12 },
  photoRemoveBtn: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  photoRemoveText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 12 },
  formGroup: { gap: 4 },
  label: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13 },
  subLabel: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13 },
  labelWithToast: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scanToastText: { color: theme.success, fontFamily: theme.font.bold, fontSize: 12 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    color: theme.ink,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontFamily: theme.font.semibold,
    fontSize: 14,
  },
  productInput: { fontSize: 15 },
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1, gap: 4 },
  stepperContainer: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    overflow: 'hidden',
  },
  stepperButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  stepperInput: {
    flex: 1,
    textAlign: 'center',
    color: theme.ink,
    fontFamily: theme.font.bold,
    fontSize: 15,
    paddingVertical: 0,
  },
  unitDropdown: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  unitDropdownText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 14 },
  priceContainer: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    paddingHorizontal: 6,
    gap: 6,
  },
  priceTouchable: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 8 },
  priceValueText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 17 },
  calculatorButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.blueSoft,
    borderWidth: 1,
    borderColor: theme.border,
  },
  labelThumbnail: {
    width: 48,
    height: 36,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
  },
  thumbnailImage: { width: '100%', height: '100%' },
  cameraLabelButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.blue,
  },
  accordionContainer: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 11,
    backgroundColor: theme.background,
    overflow: 'hidden',
  },
  accordionHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  accordionTitle: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13 },
  accordionSubtitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accordionSubtitle: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 11 },
  accordionPlus: { color: theme.muted, fontFamily: theme.font.bold, fontSize: 16 },
  accordionBody: {
    borderTopWidth: 1,
    borderColor: theme.border,
    padding: 12,
    gap: 12,
    backgroundColor: theme.surface,
  },
  detailsGroup: { gap: 6 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryChip: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceMuted,
  },
  categoryChipActive: { backgroundColor: theme.blue, borderColor: theme.blue },
  categoryChipText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 11 },
  categoryChipTextActive: { color: '#FFFFFF' },
  fieldTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  barcodeField: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    paddingHorizontal: 6,
    gap: 6,
  },
  barcodeTouchable: { flex: 1, paddingVertical: 8, paddingHorizontal: 6 },
  barcodeText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 },
  barcodePlaceholder: { color: theme.placeholder, fontFamily: theme.font.regular },
  barcodeCalcBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.blueSoft,
  },
  barcodeScanBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.blue,
  },
  eanHelperText: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 11, lineHeight: 16 },
  consultButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  consultButtonText: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 13 },
  errorMessage: { color: theme.danger, fontFamily: theme.font.semibold, fontSize: 12 },
  footer: {
    borderTopWidth: 1,
    borderColor: theme.border,
    padding: 14,
    backgroundColor: theme.surface,
  },
  completedFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  completedFooterText: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 12 },
  actionsFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  deleteButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  deleteButtonText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 14 },
  saveButton: {
    minHeight: 42,
    minWidth: 115,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: theme.blue,
  },
  saveButtonText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 14 },
  primaryButton: {
    minHeight: 38,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: theme.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 13 },
  disabled: { opacity: 0.5 },

  // Keypad Styles
  keypadOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  keypadCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 18,
    gap: 12,
    elevation: 8,
  },
  keypadHeader: { alignItems: 'center', gap: 4 },
  keypadModeTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 15 },
  keypadDisplayValue: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 26 },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  keypadKey: {
    width: '30%',
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadKeyText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 18 },
  keypadExtraActions: { gap: 8 },
  keypadClearBtn: {
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: theme.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadClearText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 13 },
  keypadCameraBtn: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: theme.blueSoft,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  keypadCameraText: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 13 },
  keypadBottomRow: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderColor: theme.border,
    paddingTop: 10,
  },
  keypadCancelBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceMuted,
  },
  keypadCancelText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13 },
  keypadConfirmBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.blue,
  },
  keypadConfirmText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 13 },

  // Scanner modal
  scannerModalOverlay: { flex: 1, backgroundColor: '#000000', justifyContent: 'space-between', padding: 16 },
  scannerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  scannerTitle: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 16 },
  scannerClose: { padding: 8 },
  cameraBox: {
    width: '100%',
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerTargetBox: {
    width: '75%',
    height: 140,
    borderWidth: 2,
    borderColor: '#0943F1',
    borderRadius: 12,
    backgroundColor: 'rgba(9, 67, 241, 0.08)',
  },
  scannerHint: { color: '#FFFFFF', textAlign: 'center', fontFamily: theme.font.semibold, fontSize: 13, marginBottom: 20 },

  // Label preview
  labelPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  labelPreviewCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    backgroundColor: theme.surface,
    padding: 16,
    gap: 12,
  },
  labelPreviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelPreviewTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 15 },
  labelPreviewImage: { width: '100%', height: 260, borderRadius: 12 },
  labelPreviewFooter: { alignItems: 'center', paddingTop: 6 },
  labelRemoveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  labelRemoveText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 13 },

  // Unit picker
  unitPickerCard: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 20,
    backgroundColor: theme.surface,
    padding: 18,
    gap: 12,
  },
  unitPickerTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 16, textAlign: 'center' },
  unitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  unitChip: {
    minWidth: 50,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitChipActive: { backgroundColor: theme.blue, borderColor: theme.blue },
  unitChipText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  unitChipTextActive: { color: '#FFFFFF' },
}));
