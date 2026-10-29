import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string;
  retryKey: number;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    componentStack: '',
    retryKey: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[app] Yakalanan render hatası:', error, errorInfo.componentStack);
    this.setState({ componentStack: errorInfo.componentStack ?? '' });
  }

  private retry = (): void => {
    this.setState((current) => ({
      error: null,
      componentStack: '',
      retryKey: current.retryKey + 1,
    }));
  };

  render(): ReactNode {
    const { error, componentStack, retryKey } = this.state;
    if (error) {
      return (
        <View style={styles.container}>
          <Text style={styles.heading}>Bir ekran hatası oluştu</Text>
          <Text style={styles.description}>
            Hata ayrıntılarını inceleyip uygulamayı yeniden deneyebilirsin.
          </Text>
          <ScrollView style={styles.details} contentContainerStyle={styles.detailsContent}>
            <Text selectable style={styles.errorText}>
              {error.name}: {error.message}
              {'\n\nComponent stack:\n'}
              {componentStack || 'Component stack bilgisi yok.'}
            </Text>
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={this.retry} style={styles.retryButton}>
            <Text style={styles.retryText}>Yeniden Dene</Text>
          </Pressable>
        </View>
      );
    }

    return <View key={retryKey} style={styles.root}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#F6F5F1',
    paddingHorizontal: 22,
    paddingTop: 64,
    paddingBottom: 28,
  },
  heading: { color: '#1C211B', fontSize: 24, fontWeight: '700' },
  description: { color: '#66695F', fontSize: 14, lineHeight: 21, marginTop: 8 },
  details: {
    flex: 1,
    marginTop: 20,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#EAE9E3',
  },
  detailsContent: { paddingBottom: 14 },
  errorText: {
    color: '#35201E',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  retryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: 18,
    borderRadius: 15,
    backgroundColor: '#252B24',
  },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
