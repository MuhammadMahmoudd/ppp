import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Txt } from '@/components/Txt';
import { colors, gradients, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { api, errorCode } from '@/lib/api';
import { haptic } from '@/lib/haptics';

export default function Welcome() {
  const s = useStrings();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (password.length < 8) return setError(s.auth.errors.weakPassword);
    setBusy(true);
    try {
      if (mode === 'signIn') {
        const { error: e } = await api.auth.signInWithPassword({ email: email.trim(), password });
        if (e) throw e;
      } else {
        const { data, error: e } = await api.auth.signUp({ email: email.trim(), password });
        if (e) throw e;
        if (!data.session) setInfo(s.auth.checkEmail);
      }
      haptic.success();
    } catch (e) {
      haptic.error();
      setError(errorCode(e) === 'invalid_login' ? s.auth.errors.invalid : s.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#2A0E18', colors.bg]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex}>
        <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={24}>
          <Animated.View entering={FadeInDown.springify()} style={styles.hero}>
            <LinearGradient colors={gradients.accent} style={styles.logo}>
              <Ionicons name="heart" size={48} color={colors.text} />
            </LinearGradient>
            <Txt variant="hero" center>{s.auth.welcomeTitle}</Txt>
            <Txt muted center>{s.auth.welcomeSubtitle}</Txt>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.form}>
            <Input label={s.auth.email} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
            <Input label={s.auth.password} value={password} onChangeText={setPassword} secureTextEntry textContentType={mode === 'signUp' ? 'newPassword' : 'password'} onSubmitEditing={submit} />
            {error ? <Txt color={colors.danger} center>{error}</Txt> : null}
            {info ? <Txt color={colors.success} center>{info}</Txt> : null}
            <Button title={mode === 'signIn' ? s.auth.signIn : s.auth.signUp} onPress={submit} loading={busy} />
            <Button variant="ghost" title={mode === 'signIn' ? s.auth.noAccount : s.auth.haveAccount} onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')} small />
          </Animated.View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xxl },
  hero: { alignItems: 'center', gap: space.md },
  logo: { width: 104, height: 104, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  form: { gap: space.md },
});
