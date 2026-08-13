import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, SafeAreaView, StatusBar, Modal, PanResponder, Animated, Linking } from 'react-native';
// ▼ データの保存・読み込み用ライブラリを追加 ▼
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [currentTab, setCurrentTab] = useState('home'); 
  const [selectedWalletId, setSelectedWalletId] = useState(null); 
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const months = Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`);
  
  const [monthlyIncomes, setMonthlyIncomes] = useState({});
  const [inputSalary, setInputSalary] = useState('');
  
  // 未仕分け支出リスト（ホームからの手入力用）
  const [unsortedExpenses, setUnsortedExpenses] = useState([]);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickMemo, setQuickMemo] = useState('');

  // 未仕分け支出の個別仕分け用モーダルステート
  const [selectedUnsortedItem, setSelectedUnsortedItem] = useState(null);
  const [sortTargetWalletId, setSortTargetWalletId] = useState('');
  const [sortTargetCategoryId, setSortTargetCategoryId] = useState('');

  // お財布データ
  const [wallets, setWallets] = useState([
    { id: '1', name: '食費袋', balance: 0, history: [] },
    { id: '2', name: '自由費袋', balance: 0, history: [] },
  ]);
  const [newWalletName, setNewWalletName] = useState('');
  // ▼ お財布編集用ステートを追加 ▼
  const [editingWalletId, setEditingWalletId] = useState(null);
  const [editWalletName, setEditWalletName] = useState('');

  // カテゴリデータ
  const [categories, setCategories] = useState([
    { id: '1', name: '食費', icon: '🍔' }, 
    { id: '2', name: '日用品', icon: '🧻' }
  ]);
  const [newCatName, setNewCatName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('🏷️'); // 自由入力用
  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatName, setEditCatName] = useState('');

  // ▼ データロード完了フラグを追加 ▼
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // ▼ データロード ▼
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedWallets = await AsyncStorage.getItem('wallets');
        const storedCategories = await AsyncStorage.getItem('categories');
        const storedMonthlyIncomes = await AsyncStorage.getItem('monthlyIncomes');
        const storedUnsortedExpenses = await AsyncStorage.getItem('unsortedExpenses');

        if (storedWallets) setWallets(JSON.parse(storedWallets));
        if (storedCategories) setCategories(JSON.parse(storedCategories));
        if (storedMonthlyIncomes) setMonthlyIncomes(JSON.parse(storedMonthlyIncomes));
        if (storedUnsortedExpenses) setUnsortedExpenses(JSON.parse(storedUnsortedExpenses));
      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadData();
  }, []);

  // ▼ データ保存 ▼
  useEffect(() => {
    if (!isDataLoaded) return;
    const saveData = async () => {
      try {
        await AsyncStorage.setItem('wallets', JSON.stringify(wallets));
        await AsyncStorage.setItem('categories', JSON.stringify(categories));
        await AsyncStorage.setItem('monthlyIncomes', JSON.stringify(monthlyIncomes));
        await AsyncStorage.setItem('unsortedExpenses', JSON.stringify(unsortedExpenses));
      } catch (e) {
        console.error("Failed to save data", e);
      }
    };
    saveData();
  }, [wallets, categories, monthlyIncomes, unsortedExpenses, isDataLoaded]);

  // ドラッグ＆ドロップ並び替え用ステート
  const [draggingType, setDraggingType] = useState(null); // 'wallet' | 'category' | null
  const [draggingIndex, setDraggingIndex] = useState(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const draggingIndexRef = useRef(null);
  draggingIndexRef.current = draggingIndex;

  const ITEM_HEIGHT = 74;

  // URLスキーム（Deep Link）受取処理
  useEffect(() => {
    const handleUrl = (url) => {
      if (!url) return;

      const queryString = url.split('?')[1];
      if (!queryString) return;

      const params = {};
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key && value) {
          params[key] = decodeURIComponent(value);
        }
      });

      const amount = parseNumber(params.amount || params.price || '0');
      const memo = params.memo || params.title || 'URLスキーム追加';

      if (amount > 0) {
        setUnsortedExpenses(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            month: selectedMonth,
            amount: amount,
            memo: memo,
          }
        ]);
        Alert.alert("受付完了", `未仕分け支出を追加しました\n金額: ${amount.toLocaleString()}円\nメモ: ${memo}`);
      }
    };

    Linking.getInitialURL().then(url => {
      if (url) handleUrl(url);
    });

    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [selectedMonth]);

  const createPanResponder = (type, index, list, setList) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => draggingType === type,
      onPanResponderGrant: () => {
        setDraggingType(type);
        setDraggingIndex(index);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gestureState) => {
        const curIdx = draggingIndexRef.current;
        if (curIdx !== null) {
          const moveIndex = Math.round(gestureState.dy / ITEM_HEIGHT);
          let targetIndex = curIdx + moveIndex;
          if (targetIndex < 0) targetIndex = 0;
          if (targetIndex >= list.length) targetIndex = list.length - 1;

          if (targetIndex !== curIdx) {
            const updated = [...list];
            const [movedItem] = updated.splice(curIdx, 1);
            updated.splice(targetIndex, 0, movedItem);
            setList(updated);
          }
        }
        setDraggingType(null);
        setDraggingIndex(null);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderTerminate: () => {
        setDraggingType(null);
        setDraggingIndex(null);
        pan.setValue({ x: 0, y: 0 });
      }
    });
  };

  // 仕分け用ステート
  const [sortAmount, setSortAmount] = useState('');
  const [targetWalletId, setTargetWalletId] = useState(null);

  // 支出入力用ステート
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseMemo, setExpenseMemo] = useState('');
  const [expenseWalletId, setExpenseWalletId] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');

  // 収入入力用ステート
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeMemo, setIncomeMemo] = useState('');
  const [incomeWalletId, setIncomeWalletId] = useState('');

  // 履歴詳細・編集用ステート
  const [editingHistoryItem, setEditingHistoryItem] = useState(null);
  const [editHistoryMemo, setEditHistoryMemo] = useState('');
  const [editHistoryAmount, setEditHistoryAmount] = useState('');
  const [editHistoryWalletId, setEditHistoryWalletId] = useState('');
  const [editHistoryCategoryId, setEditHistoryCategoryId] = useState('');

  // カンマ区切りフォーマット用補助関数
  const formatInputNumber = (val) => {
    const rawNum = val.toString().replace(/[^0-9]/g, '');
    if (!rawNum) return '';
    return parseInt(rawNum, 10).toLocaleString();
  };

  const parseNumber = (val) => {
    return parseInt(val.toString().replace(/[^0-9]/g, ''), 10) || 0;
  };

  // ホームからの簡易未仕分け支出追加
  const addUnsortedExpense = () => {
    const amount = parseNumber(quickAmount);
    if (!amount) return Alert.alert("エラー", "金額を入力してください");

    setUnsortedExpenses([
      ...unsortedExpenses,
      {
        id: Date.now().toString(),
        month: selectedMonth,
        amount: amount,
        memo: quickMemo || '未仕分けメモ',
      }
    ]);

    setQuickAmount('');
    setQuickMemo('');
  };

  // 未仕分け支出の個別仕分け実行処理
  const executeItemSort = () => {
    if (!selectedUnsortedItem) return;
    if (!sortTargetWalletId) return Alert.alert("エラー", "お財布を選択してください");

    const selectedCategory = categories.find(c => c.id === sortTargetCategoryId);
    const categoryName = selectedCategory ? selectedCategory.name : selectedUnsortedItem.memo;

    setWallets(wallets.map(w => w.id === sortTargetWalletId ? {
      ...w,
      balance: w.balance - selectedUnsortedItem.amount,
      history: [...w.history, { 
        id: Date.now().toString(), 
        month: selectedUnsortedItem.month, 
        memo: categoryName, 
        detailMemo: selectedUnsortedItem.memo,
        amount: -selectedUnsortedItem.amount 
      }]
    } : w));

    setUnsortedExpenses(unsortedExpenses.filter(u => u.id !== selectedUnsortedItem.id));

    setSelectedUnsortedItem(null);
    setSortTargetWalletId('');
    setSortTargetCategoryId('');
    Alert.alert("完了", "仕分けが完了しました！");
  };

  // お財布追加処理
  const addWallet = () => {
    if (!newWalletName.trim()) return Alert.alert("エラー", "お財布の名前を入力してください");
    setWallets([...wallets, { id: Date.now().toString(), name: newWalletName, balance: 0, history: [] }]);
    setNewWalletName('');
  };

  // お財布削除処理（使用中ガード付き）
  const deleteWallet = (walletId) => {
    const target = wallets.find(w => w.id === walletId);
    if (target && target.history.length > 0) {
      return Alert.alert("削除不可", "このお財布は使用履歴があるため削除できません。");
    }
    setWallets(wallets.filter(w => w.id !== walletId));
  };

  // お財布リネーム実行
  const saveWalletRename = (id) => {
    if (!editWalletName.trim()) return Alert.alert("エラー", "名前を入力してください");
    setWallets(wallets.map(w => w.id === id ? { ...w, name: editWalletName } : w));
    setEditingWalletId(null);
    setEditWalletName('');
  };

  // 仕分け実行
  const executeSort = () => {
    const amount = parseNumber(sortAmount);
    if (!amount || !targetWalletId) return Alert.alert("エラー", "金額と財布を選択してください");
    if ((monthlyIncomes[selectedMonth] || 0) < amount) return Alert.alert("エラー", "資金が足りません");

    setMonthlyIncomes({ ...monthlyIncomes, [selectedMonth]: (monthlyIncomes[selectedMonth] || 0) - amount });
    setWallets(wallets.map(w => w.id === targetWalletId ? {
      ...w, 
      balance: w.balance + amount,
      history: [...w.history, { id: Date.now().toString(), month: selectedMonth, memo: '仕分け受取', detailMemo: '', amount: amount }]
    } : w));
    
    setSortAmount('');
    Alert.alert("完了", "仕分けしました！");
  };

  // 支出追加実行
  const executeExpense = () => {
    const amount = parseNumber(expenseAmount);
    if (!amount || !expenseWalletId) return Alert.alert("エラー", "金額とお財布を選択してください");

    const selectedCategory = categories.find(c => c.id === expenseCategoryId);
    const categoryName = selectedCategory ? selectedCategory.name : (expenseMemo || 'その他支出');

    setWallets(wallets.map(w => w.id === expenseWalletId ? {
      ...w,
      balance: w.balance - amount,
      history: [...w.history, { id: Date.now().toString(), month: selectedMonth, memo: categoryName, detailMemo: expenseMemo, amount: -amount }]
    } : w));

    setExpenseAmount('');
    setExpenseMemo('');
    setExpenseCategoryId('');
    setExpenseModalVisible(false);
    Alert.alert("完了", "支出を記録しました");
  };

  // 収入追加実行
  const executeIncome = () => {
    const amount = parseNumber(incomeAmount);
    if (!amount || !incomeWalletId) return Alert.alert("エラー", "金額とお財布を選択してください");

    const memoText = incomeMemo.trim() || '収入';

    setWallets(wallets.map(w => w.id === incomeWalletId ? {
      ...w,
      balance: w.balance + amount,
      history: [...w.history, { id: Date.now().toString(), month: selectedMonth, memo: '収入', detailMemo: memoText, amount: amount }]
    } : w));

    setIncomeAmount('');
    setIncomeMemo('');
    setIncomeWalletId('');
    setIncomeModalVisible(false);
    Alert.alert("完了", "収入を記録しました");
  };

  // 履歴の編集保存（お財布・カテゴリ変更対応）
  const saveHistoryEdit = () => {
    if (!editingHistoryItem) return;
    const newAmount = parseNumber(editHistoryAmount);
    if (!newAmount) return Alert.alert("エラー", "金額を入力してください");

    const sign = editingHistoryItem.amount < 0 ? -1 : 1;
    const updatedAmount = newAmount * sign;

    const selectedCat = categories.find(c => c.id === editHistoryCategoryId);
    const updatedCategoryName = selectedCat ? selectedCat.name : editingHistoryItem.memo;

    setWallets(prevWallets => {
      let newWallets = prevWallets.map(w => {
        if (w.id === selectedWalletId) {
          return {
            ...w,
            balance: w.balance - editingHistoryItem.amount,
            history: w.history.filter(h => h.id !== editingHistoryItem.id)
          };
        }
        return w;
      });

      newWallets = newWallets.map(w => {
        if (w.id === editHistoryWalletId) {
          const updatedHistoryItem = {
            ...editingHistoryItem,
            amount: updatedAmount,
            memo: updatedCategoryName,
            detailMemo: editHistoryMemo
          };

          return {
            ...w,
            balance: w.balance + updatedAmount,
            history: [...w.history, updatedHistoryItem]
          };
        }
        return w;
      });

      return newWallets;
    });

    setEditingHistoryItem(null);
    Alert.alert("完了", "更新しました");
  };

  // 履歴の削除
  const deleteHistoryItem = (historyId) => {
    const targetWallet = wallets.find(w => w.id === selectedWalletId);
    if (!targetWallet) return;
    const targetHistory = targetWallet.history.find(h => h.id === historyId);
    if (!targetHistory) return;

    setWallets(wallets.map(w => {
      if (w.id === selectedWalletId) {
        return {
          ...w,
          balance: w.balance - targetHistory.amount,
          history: w.history.filter(h => h.id !== historyId)
        };
      }
      return w;
    }));

    setEditingHistoryItem(null);
    Alert.alert("完了", "削除しました");
  };

  // カテゴリ追加処理
  const addCategory = () => {
    if (!newCatName.trim()) return Alert.alert("エラー", "カテゴリ名を入力してください");
    setCategories([...categories, { id: Date.now().toString(), name: newCatName, icon: selectedIcon || '🏷️' }]);
    setNewCatName('');
    setSelectedIcon('🏷️');
  };

  // カテゴリ削除処理（使用中ガード付き）
  const deleteCategory = (catName) => {
    const isUsed = wallets.some(w => w.history.some(h => h.memo === catName));
    if (isUsed) {
      return Alert.alert("削除不可", "このカテゴリは使用されているため削除できません。");
    }
    setCategories(categories.filter(c => c.name !== catName));
  };

  // カテゴリリネーム実行
  const saveCatRename = (id) => {
    if (!editCatName.trim()) return Alert.alert("エラー", "名前を入力してください");
    setCategories(categories.map(c => c.id === id ? { ...c, name: editCatName } : c));
    setEditingCatId(null);
    setEditCatName('');
  };

  // 月間総支出計算
  const getMonthlyTotalExpense = () => {
    let total = 0;
    wallets.forEach(w => {
      w.history.forEach(h => {
        if (h.month === selectedMonth && h.amount < 0) {
          total += Math.abs(h.amount);
        }
      });
    });
    return total;
  };

  // 年間レポート用データ構築
  const getAnnualReportDetailed = () => {
    const report = {};
    wallets.forEach(w => w.history.forEach(h => {
      if (h.month.startsWith(selectedYear) && h.amount < 0) {
        const catName = h.memo;
        const monthNum = parseInt(h.month.split('-')[1], 10);
        const amt = Math.abs(h.amount);

        if (!report[catName]) {
          report[catName] = { total: 0, monthly: {} };
        }
        report[catName].total += amt;
        report[catName].monthly[monthNum] = (report[catName].monthly[monthNum] || 0) + amt;
      }
    }));
    return report;
  };

  const formatNum = (num) => (num || 0).toLocaleString();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        
        {/* ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedYear((prev) => (parseInt(prev)-1).toString())}><Text style={styles.navText}>◀</Text></TouchableOpacity>
          <Text style={styles.yearText}>{selectedYear}年</Text>
          <TouchableOpacity onPress={() => setSelectedYear((prev) => (parseInt(prev)+1).toString())}><Text style={styles.navText}>▶</Text></TouchableOpacity>
        </View>

        {/* 月選択 */}
        <View style={styles.monthContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthScroll}>
            {months.map(m => (
              <TouchableOpacity key={m} onPress={() => setSelectedMonth(m)} style={[styles.monthTab, selectedMonth === m && styles.monthTabActive]}>
                <Text style={selectedMonth === m ? styles.monthTextActive : styles.monthText}>{parseInt(m.split('-')[1])}月</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.content}>
          {selectedWalletId ? (
            <ScrollView contentContainerStyle={styles.innerScroll}>
              <TouchableOpacity onPress={() => setSelectedWalletId(null)}><Text style={styles.back}>← お財布一覧へ</Text></TouchableOpacity>
              
              {(() => {
                const wallet = wallets.find(w => w.id === selectedWalletId);
                if (!wallet) return null;

                let runningBalance = 0;
                const historyWithBalance = wallet.history.map(h => {
                  runningBalance += h.amount;
                  return { ...h, currentBalance: runningBalance };
                });

                return (
                  <>
                    <View style={{ marginBottom: 16 }}>
                      <Text style={styles.title}>{wallet.name} 履歴</Text>
                      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 4 }}>
                        現在の最終残金: {formatNum(wallet.balance)}円
                      </Text>
                    </View>
                    
                    {historyWithBalance.map(h => (
                      <View key={h.id} style={styles.cardCol}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View>
                            <Text style={styles.bold}>{h.memo}</Text>
                            {h.detailMemo ? <Text style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>📝 {h.detailMemo}</Text> : null}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.bold, { color: h.amount < 0 ? '#e53e3e' : '#2b6cb0' }]}>{formatNum(h.amount)}円</Text>
                            <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>({formatNum(h.currentBalance)}円)</Text>
                            
                            <TouchableOpacity 
                              onPress={() => {
                                setEditingHistoryItem(h);
                                setEditHistoryMemo(h.detailMemo || '');
                                setEditHistoryAmount(formatInputNumber(Math.abs(h.amount).toString()));
                                setEditHistoryWalletId(selectedWalletId);
                                const currentCat = categories.find(c => c.name === h.memo);
                                setEditHistoryCategoryId(currentCat ? currentCat.id : '');
                              }}
                              style={{ marginTop: 4 }}
                            >
                              <Text style={{ color: '#5cacee', fontSize: 12 }}>編集</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ))}
                  </>
                );
              })()}
            </ScrollView>
          ) : (
            <ScrollView 
              contentContainerStyle={styles.innerScroll}
              scrollEnabled={draggingType === null}
            >
              {currentTab === 'home' && (
                <>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
                    <Text style={styles.title}>ホーム</Text>
                    <View style={{flexDirection: 'row', gap: 6}}>
                      <TouchableOpacity style={[styles.expenseBtn, { backgroundColor: '#2b6cb0' }]} onPress={() => setIncomeModalVisible(true)}>
                        <Text style={styles.expenseBtnText}>＋ 収入を入力</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.expenseBtn} onPress={() => setExpenseModalVisible(true)}>
                        <Text style={styles.expenseBtnText}>＋ 支出を入力</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* 今月の総支出 */}
                  <View style={styles.cardCol}>
                    <Text style={styles.label}>今月の総支出</Text>
                    <Text style={[styles.amount, { color: '#e53e3e' }]}>{formatNum(getMonthlyTotalExpense())}円</Text>
                  </View>

                  {/* 手軽にメモ（未仕分け支出入力枠） */}
                  <View style={[styles.cardCol, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd', borderWidth: 1 }]}>
                    <Text style={[styles.label, { color: '#0369a1', fontWeight: 'bold' }]}>📝 手軽にメモ支出を追加</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <TextInput
                        keyboardType="numeric"
                        placeholder="金額 (円)"
                        value={quickAmount}
                        onChangeText={(t) => setQuickAmount(formatInputNumber(t))}
                        style={[styles.input, { flex: 1 }]}
                      />
                      <TextInput
                        placeholder="メモ (例: コンビニ)"
                        value={quickMemo}
                        onChangeText={setQuickMemo}
                        style={[styles.input, { flex: 1.5 }]}
                      />
                      <TouchableOpacity style={[styles.btn, { backgroundColor: '#0284c7' }]} onPress={addUnsortedExpense}>
                        <Text style={styles.btnText}>追加</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* 未仕分け支出（タップで仕分け可能） */}
                  <View style={[styles.cardCol, { backgroundColor: '#fff5f5', borderColor: '#feb2b2', borderWidth: 1 }]}>
                    <Text style={[styles.label, { color: '#c53030', fontWeight: 'bold', marginBottom: 8 }]}>
                      以下の支出を仕分けてください（タップで仕分け）
                    </Text>

                    {unsortedExpenses.filter(u => u.month === selectedMonth).length === 0 ? (
                      <Text style={{ color: '#a0aec0', fontSize: 13, fontStyle: 'italic' }}>未仕分けの支出メモはありません</Text>
                    ) : (
                      unsortedExpenses.filter(u => u.month === selectedMonth).map(u => (
                        <TouchableOpacity 
                          key={u.id} 
                          onPress={() => setSelectedUnsortedItem(u)}
                          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#fed7d7' }}
                        >
                          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                            <Text style={{fontSize: 12, color: '#c53030'}}>👉</Text>
                            <Text style={{ color: '#2d3748', fontWeight: '500' }}>{u.memo}</Text>
                          </View>
                          <Text style={{ color: '#e53e3e', fontWeight: 'bold' }}>{formatNum(u.amount)}円</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>

                  {wallets.map(w => (
                    <TouchableOpacity key={w.id} style={styles.card} onPress={() => setSelectedWalletId(w.id)}>
                      <Text style={styles.bold}>{w.name}</Text>
                      <Text style={{fontWeight: 'bold', fontSize: 16}}>{formatNum(w.balance)}円</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              {currentTab === 'sortFunds' && (
                <>
                  <Text style={styles.title}>仕分け実行</Text>
                  
                  {/* 未仕分け資金の入力欄 */}
                  <View style={[styles.cardCol, {marginBottom: 20}]}>
                    <Text style={styles.label}>未仕分け資金の追加・設定</Text>
                    <Text style={styles.amount}>現在: {formatNum(monthlyIncomes[selectedMonth])}円</Text>
                    <View style={styles.inputRow}>
                      <TextInput 
                        keyboardType="numeric" 
                        placeholder="金額を入力" 
                        value={inputSalary} 
                        onChangeText={(text) => setInputSalary(formatInputNumber(text))} 
                        style={styles.input} 
                      />
                      <TouchableOpacity style={styles.btn} onPress={() => { setMonthlyIncomes({...monthlyIncomes, [selectedMonth]: (monthlyIncomes[selectedMonth] || 0) + parseNumber(inputSalary)}); setInputSalary(''); }}>
                        <Text style={styles.btnText}>追加</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.btn, { backgroundColor: '#64748b' }]} onPress={() => { setMonthlyIncomes({...monthlyIncomes, [selectedMonth]: parseNumber(inputSalary)}); setInputSalary(''); }}>
                        <Text style={styles.btnText}>変更</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.label}>金額</Text>
                  <TextInput 
                    keyboardType="numeric" 
                    placeholder="例: 30,000" 
                    value={sortAmount} 
                    onChangeText={(text) => setSortAmount(formatInputNumber(text))} 
                    style={styles.inputFull} 
                  />
                  
                  <Text style={styles.label}>仕分け先</Text>
                  {wallets.map(w => (
                    <TouchableOpacity key={w.id} style={[styles.card, targetWalletId === w.id && {borderColor: '#5cacee', borderWidth: 2}]} onPress={() => setTargetWalletId(w.id)}>
                      <Text>{w.name}</Text>
                      <Text style={{color: '#888'}}>(現在: {formatNum(w.balance)}円)</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.btnFull} onPress={executeSort}><Text style={styles.btnText}>実行</Text></TouchableOpacity>
                </>
              )}

              {/* 設定タブ（お財布・カテゴリ管理を統合） */}
              {currentTab === 'settings' && (
                <>
                  <Text style={styles.title}>設定</Text>
                  <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>※項目を長押ししながら上下に動かすと並び替えができます</Text>

                  {/* お財布管理セクション */}
                  <Text style={[styles.label, { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginTop: 8 }]}>👛 お財布管理</Text>
                  <View style={styles.cardCol}>
                    <Text style={styles.label}>新しくお財布を追加</Text>
                    <View style={styles.inputRow}>
                      <TextInput placeholder="お財布名（例: 特別費）" value={newWalletName} onChangeText={setNewWalletName} style={styles.input} />
                      <TouchableOpacity style={styles.btn} onPress={addWallet}><Text style={styles.btnText}>追加</Text></TouchableOpacity>
                    </View>
                  </View>

                  {wallets.map((w, index) => {
                    const isDragging = draggingType === 'wallet' && draggingIndex === index;
                    const pr = createPanResponder('wallet', index, wallets, setWallets);

                    return (
                      <Animated.View 
                        key={w.id} 
                        {...pr.panHandlers}
                        style={[
                          styles.card,
                          isDragging && {
                            transform: pan.getTranslateTransform(),
                            zIndex: 999,
                            elevation: 10,
                            backgroundColor: '#e0f2fe',
                            borderColor: '#0284c7',
                            borderWidth: 2,
                            shadowOpacity: 0.2,
                          }
                        ]}
                      >
                        {editingWalletId === w.id ? (
                          <View style={{flexDirection: 'row', flex: 1, gap: 8, alignItems: 'center'}}>
                            <TextInput value={editWalletName} onChangeText={setEditWalletName} style={[styles.input, {paddingVertical: 4}]} />
                            <TouchableOpacity style={[styles.btn, {paddingHorizontal: 10}]} onPress={() => saveWalletRename(w.id)}><Text style={styles.btnText}>保存</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => setEditingWalletId(null)}><Text style={{color: '#666'}}>取消</Text></TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity 
                            activeOpacity={0.8}
                            onLongPress={() => {
                              setDraggingType('wallet');
                              setDraggingIndex(index);
                            }}
                            style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                          >
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                              <Text style={{color: '#94a3b8', fontSize: 16}}>☰</Text>
                              <Text style={styles.bold}>{w.name}</Text>
                            </View>
                            <View style={{flexDirection: 'row', gap: 12}}>
                              <TouchableOpacity onPress={() => { setEditingWalletId(w.id); setEditWalletName(w.name); }}>
                                <Text style={{color: '#5cacee'}}>編集</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => deleteWallet(w.id)}>
                                <Text style={{color:'red'}}>削除</Text>
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        )}
                      </Animated.View>
                    );
                  })}

                  <View style={{ height: 20 }} />

                  {/* カテゴリ管理セクション */}
                  <Text style={[styles.label, { fontSize: 16, fontWeight: 'bold', color: '#1e293b' }]}>🏷️ カテゴリ管理</Text>
                  <View style={styles.cardCol}>
                    <Text style={styles.label}>新カテゴリの追加</Text>
                    <Text style={styles.label}>アイコン（好きな絵文字や文字を入力）</Text>
                    <TextInput 
                      placeholder="例: 🍕" 
                      value={selectedIcon} 
                      onChangeText={setSelectedIcon} 
                      style={styles.inputFull} 
                    />

                    <Text style={styles.label}>カテゴリ名</Text>
                    <TextInput placeholder="カテゴリ名（例: 外食費）" value={newCatName} onChangeText={setNewCatName} style={styles.inputFull} />
                    <TouchableOpacity style={styles.btnFull} onPress={addCategory}><Text style={styles.btnText}>追加</Text></TouchableOpacity>
                  </View>

                  {categories.map((c, index) => {
                    const isDragging = draggingType === 'category' && draggingIndex === index;
                    const pr = createPanResponder('category', index, categories, setCategories);

                    return (
                      <Animated.View 
                        key={c.id} 
                        {...pr.panHandlers}
                        style={[
                          styles.card,
                          isDragging && {
                            transform: pan.getTranslateTransform(),
                            zIndex: 999,
                            elevation: 10,
                            backgroundColor: '#e0f2fe',
                            borderColor: '#0284c7',
                            borderWidth: 2,
                            shadowOpacity: 0.2,
                          }
                        ]}
                      >
                        {editingCatId === c.id ? (
                          <View style={{flexDirection: 'row', flex: 1, gap: 8, alignItems: 'center'}}>
                            <TextInput value={editCatName} onChangeText={setEditCatName} style={[styles.input, {paddingVertical: 4}]} />
                            <TouchableOpacity style={[styles.btn, {paddingHorizontal: 10}]} onPress={() => saveCatRename(c.id)}><Text style={styles.btnText}>保存</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => setEditingCatId(null)}><Text style={{color: '#666'}}>取消</Text></TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity 
                            activeOpacity={0.8}
                            onLongPress={() => {
                              setDraggingType('category');
                              setDraggingIndex(index);
                            }}
                            style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                          >
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                              <Text style={{color: '#94a3b8', fontSize: 16}}>☰</Text>
                              <Text style={{fontSize: 16}}>{c.icon} {c.name}</Text>
                            </View>
                            <View style={{flexDirection: 'row', gap: 12}}>
                              <TouchableOpacity onPress={() => { setEditingCatId(c.id); setEditCatName(c.name); }}>
                                <Text style={{color: '#5cacee'}}>編集</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => deleteCategory(c.name)}>
                                <Text style={{color: 'red'}}>削除</Text>
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        )}
                      </Animated.View>
                    );
                  })}
                </>
              )}

              {currentTab === 'report' && (
                <>
                  <Text style={styles.title}>年間支出レポート ({selectedYear}年)</Text>
                  {Object.keys(getAnnualReportDetailed()).length === 0 ? (
                    <Text style={{textAlign:'center', marginTop:20, color:'#888'}}>支出履歴がありません</Text>
                  ) : (
                    Object.keys(getAnnualReportDetailed()).map(cat => {
                      const data = getAnnualReportDetailed()[cat];
                      const matchedCat = categories.find(c => c.name === cat);
                      const catIcon = matchedCat ? matchedCat.icon : '🏷️';

                      return (
                        <View key={cat} style={styles.cardCol}>
                          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                            <Text style={styles.bold}>{catIcon} {cat}</Text>
                            <Text style={[styles.bold, {color: '#e53e3e', fontSize: 18}]}>計 {formatNum(data.total)}円</Text>
                          </View>
                          
                          <View style={{borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8}}>
                            {Object.keys(data.monthly).sort((a,b) => parseInt(a) - parseInt(b)).map(m => (
                              <View key={m} style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2}}>
                                <Text style={{color: '#64748b', fontSize: 13}}>{m}月</Text>
                                <Text style={{color: '#334155', fontSize: 13, fontWeight: '500'}}>{formatNum(data.monthly[m])}円</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      );
                    })
                  )}
                </>
              )}
            </ScrollView>
          )}
        </View>

        {/* 収入入力モーダル */}
        <Modal visible={incomeModalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.title}>💰 収入の入力</Text>
              
              <Text style={styles.label}>金額</Text>
              <TextInput 
                keyboardType="numeric" 
                placeholder="例: 5,000" 
                value={incomeAmount} 
                onChangeText={(text) => setIncomeAmount(formatInputNumber(text))} 
                style={styles.inputFull} 
              />

              <Text style={styles.label}>メモ（任意）</Text>
              <TextInput placeholder="例: 臨時収入、給料" value={incomeMemo} onChangeText={setIncomeMemo} style={styles.inputFull} />

              <Text style={styles.label}>どのお財布に入れる？</Text>
              {wallets.map(w => (
                <TouchableOpacity key={w.id} style={[styles.card, incomeWalletId === w.id && {borderColor: '#2b6cb0', borderWidth: 2}]} onPress={() => setIncomeWalletId(w.id)}>
                  <Text>{w.name} (残高: {formatNum(w.balance)}円)</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={[styles.btnFull, {backgroundColor: '#2b6cb0'}]} onPress={executeIncome}>
                <Text style={styles.btnText}>収入を記録する</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={{marginTop: 15, alignItems: 'center'}} onPress={() => setIncomeModalVisible(false)}>
                <Text style={{color: '#666'}}>キャンセル</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* 支出入力モーダル */}
        <Modal visible={expenseModalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.title}>💸 支出の入力</Text>
              
              <Text style={styles.label}>金額</Text>
              <TextInput 
                keyboardType="numeric" 
                placeholder="例: 1,200" 
                value={expenseAmount} 
                onChangeText={(text) => setExpenseAmount(formatInputNumber(text))} 
                style={styles.inputFull} 
              />

              <Text style={styles.label}>カテゴリ（選択）</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10}}>
                {categories.map(c => (
                  <TouchableOpacity 
                    key={c.id} 
                    onPress={() => setExpenseCategoryId(c.id)} 
                    style={[
                      styles.card, 
                      { marginRight: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 0 },
                      expenseCategoryId === c.id && { borderColor: '#e53e3e', borderWidth: 2 }
                    ]}
                  >
                    <Text>{c.icon} {c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <Text style={styles.label}>メモ（任意）</Text>
              <TextInput placeholder="例: ランチ代" value={expenseMemo} onChangeText={setExpenseMemo} style={styles.inputFull} />

              <Text style={styles.label}>どのお財布から払う？</Text>
              {wallets.map(w => (
                <TouchableOpacity key={w.id} style={[styles.card, expenseWalletId === w.id && {borderColor: '#e53e3e', borderWidth: 2}]} onPress={() => setExpenseWalletId(w.id)}>
                  <Text>{w.name} (残高: {formatNum(w.balance)}円)</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={[styles.btnFull, {backgroundColor: '#e53e3e'}]} onPress={executeExpense}>
                <Text style={styles.btnText}>支出を記録する</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={{marginTop: 15, alignItems: 'center'}} onPress={() => setExpenseModalVisible(false)}>
                <Text style={{color: '#666'}}>キャンセル</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* 未仕分け支出の個別仕分け用モーダル */}
        <Modal visible={selectedUnsortedItem !== null} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.title}>🏷️ 支出の仕分け</Text>

              {selectedUnsortedItem && (
                <View style={[styles.cardCol, { backgroundColor: '#f8fafc', marginBottom: 15 }]}>
                  <Text style={styles.label}>メモ: {selectedUnsortedItem.memo}</Text>
                  <Text style={[styles.amount, { color: '#e53e3e' }]}>{formatNum(selectedUnsortedItem.amount)}円</Text>
                </View>
              )}

              <Text style={styles.label}>1. お財布を選択（必須）</Text>
              {wallets.map(w => (
                <TouchableOpacity 
                  key={w.id} 
                  style={[styles.card, sortTargetWalletId === w.id && {borderColor: '#5cacee', borderWidth: 2}]} 
                  onPress={() => setSortTargetWalletId(w.id)}
                >
                  <Text>{w.name} (残高: {formatNum(w.balance)}円)</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.label}>2. カテゴリを選択（任意・年間レポートに反映）</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15}}>
                {categories.map(c => (
                  <TouchableOpacity 
                    key={c.id} 
                    onPress={() => setSortTargetCategoryId(c.id)} 
                    style={[
                      styles.card, 
                      { marginRight: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 0 },
                      sortTargetCategoryId === c.id && { borderColor: '#5cacee', borderWidth: 2 }
                    ]}
                  >
                    <Text>{c.icon} {c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.btnFull} onPress={executeItemSort}>
                <Text style={styles.btnText}>仕分ける</Text>
              </TouchableOpacity>

              <TouchableOpacity style={{marginTop: 15, alignItems: 'center'}} onPress={() => setSelectedUnsortedItem(null)}>
                <Text style={{color: '#666'}}>キャンセル</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* お財布履歴編集用モーダル */}
        <Modal visible={editingHistoryItem !== null} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.title}>✏️ 支出詳細の編集</Text>
              
              <Text style={styles.label}>金額 (円)</Text>
              <TextInput 
                keyboardType="numeric" 
                value={editHistoryAmount} 
                onChangeText={(t) => setEditHistoryAmount(formatInputNumber(t))} 
                style={styles.inputFull} 
              />

              <Text style={styles.label}>カテゴリ</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10}}>
                {categories.map(c => (
                  <TouchableOpacity 
                    key={c.id} 
                    onPress={() => setEditHistoryCategoryId(c.id)} 
                    style={[
                      styles.card, 
                      { marginRight: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 0 },
                      editHistoryCategoryId === c.id && { borderColor: '#5cacee', borderWidth: 2 }
                    ]}
                  >
                    <Text>{c.icon} {c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>メモ</Text>
              <TextInput 
                value={editHistoryMemo} 
                onChangeText={setEditHistoryMemo} 
                placeholder="メモを入力" 
                style={styles.inputFull} 
              />

              <Text style={styles.label}>お財布（選択）</Text>
              {wallets.map(w => (
                <TouchableOpacity 
                  key={w.id} 
                  style={[styles.card, editHistoryWalletId === w.id && {borderColor: '#5cacee', borderWidth: 2}]} 
                  onPress={() => setEditHistoryWalletId(w.id)}
                >
                  <Text>{w.name} (残高: {formatNum(w.balance)}円)</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={styles.btnFull} onPress={saveHistoryEdit}>
                <Text style={styles.btnText}>更新する</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.btnFull, { backgroundColor: '#ef4444', marginTop: 8 }]} 
                onPress={() => editingHistoryItem && deleteHistoryItem(editingHistoryItem.id)}
              >
                <Text style={styles.btnText}>この履歴を削除</Text>
              </TouchableOpacity>

              <TouchableOpacity style={{marginTop: 15, alignItems: 'center'}} onPress={() => setEditingHistoryItem(null)}>
                <Text style={{color: '#666'}}>キャンセル</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* タブバー */}
        <View style={styles.tabBar}>
          {[ {id: 'home', l: '🏠'}, {id: 'sortFunds', l: '💸'}, {id: 'report', l: '📊'}, {id: 'settings', l: '⚙️'} ].map(t => (
            <TouchableOpacity key={t.id} onPress={() => { setSelectedWalletId(null); setCurrentTab(t.id); }} style={styles.tab}>
              <Text style={currentTab === t.id ? styles.activeTab : styles.inactiveTab}>{t.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f4f8', paddingTop: 25 },
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
  yearText: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 20, color: '#333' },
  navText: { color: '#666', padding: 5, fontSize: 16 },
  monthContainer: { height: 45, marginBottom: 5 },
  monthScroll: { paddingHorizontal: 15, alignItems: 'center' },
  monthTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginHorizontal: 4, backgroundColor: '#fff' },
  monthTabActive: { backgroundColor: '#5cacee' },
  monthText: { color: '#666', fontSize: 14 },
  monthTextActive: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  content: { flex: 1 },
  innerScroll: { padding: 20, paddingBottom: 100 },
  card: { backgroundColor: '#fff', padding: 18, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCol: { backgroundColor: '#fff', padding: 18, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  title: { fontSize: 22, fontWeight: '800', color: '#333' },
  input: { flex: 1, backgroundColor: '#f8fafc', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  inputRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { backgroundColor: '#5cacee', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, justifyContent: 'center' },
  inputFull: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  btnFull: { backgroundColor: '#5cacee', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontWeight: 'bold' },
  expenseBtn: { backgroundColor: '#e53e3e', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  expenseBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  label: { color: '#64748b', fontSize: 13, fontWeight: '500', marginBottom: 4 },
  amount: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  bold: { fontWeight: 'bold', fontSize: 16 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingBottom: 50, paddingTop: 14, borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 8 },
  tab: { flex: 1, alignItems: 'center' },
  activeTab: { fontSize: 24, opacity: 1 },
  inactiveTab: { fontSize: 24, opacity: 0.3 },
  back: { color: '#5cacee', marginBottom: 10, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20 }
});
