'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save } from 'lucide-react';
import { CS2Skin, CS2Agent, CS2Sticker, CS2Keychain } from '@/types/server';
import { fetchStickersData, fetchKeychainsData } from '@/lib/github-data';
import StickerSelector from '@/components/StickerSelector';
import KeychainSelector from '@/components/KeychainSelector';
import WeaponPreview from '@/components/WeaponPreview';

interface CustomizationSettings {
  wear: number;
  seed: number;
  nameTag: string;
  statTrak: boolean;
  stickers: (CS2Sticker | null)[];
  keychain: CS2Keychain | null;
}

const wearConditions = [
  { min: 0, max: 0.07, name: 'Factory New', color: 'bg-green-500' },
  { min: 0.07, max: 0.15, name: 'Minimal Wear', color: 'bg-blue-500' },
  { min: 0.15, max: 0.38, name: 'Field-Tested', color: 'bg-yellow-500' },
  { min: 0.38, max: 0.45, name: 'Well-Worn', color: 'bg-orange-500' },
  { min: 0.45, max: 1.0, name: 'Battle-Scarred', color: 'bg-red-500' },
];

function WeaponCustomizeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  // Get weapon data from URL params
  const weaponData = searchParams.get('weapon');
  const agentData = searchParams.get('agent');
  const selectedTeam = parseInt(searchParams.get('team') || '2') as 2 | 3;

  const [skin, setSkin] = useState<CS2Skin | null>(null);
  const [agent, setAgent] = useState<CS2Agent | null>(null);
  const [settings, setSettings] = useState<CustomizationSettings>({
    wear: 0.1,
    seed: 1,
    nameTag: '',
    statTrak: false,
    stickers: [null, null, null, null, null],
    keychain: null,
  });

  const [isApplying, setIsApplying] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [stickersData, setStickersData] = useState<CS2Sticker[]>([]);
  const [keychainsData, setKeychainsData] = useState<CS2Keychain[]>([]);

  useEffect(() => {
    if (weaponData) {
      try {
        const parsedSkin = JSON.parse(decodeURIComponent(weaponData));
        setSkin(parsedSkin);
      } catch (error) {
        console.error('Error parsing weapon data:', error);
        router.push('/skin-changer');
      }
    } else if (agentData) {
      try {
        const parsedAgent = JSON.parse(decodeURIComponent(agentData));
        setAgent(parsedAgent);
      } catch (error) {
        console.error('Error parsing agent data:', error);
        router.push('/skin-changer');
      }
    } else {
      router.push('/skin-changer');
    }
  }, [weaponData, agentData, router]);

  // Load stickers and keychains data
  useEffect(() => {
    const loadStickersAndKeychains = async () => {
      try {
        // Load stickers directly from GitHub
        const stickersData = await fetchStickersData();
        setStickersData(stickersData);

        // Load keychains directly from GitHub
        const keychainsData = await fetchKeychainsData();
        setKeychainsData(keychainsData);
      } catch (error) {
        console.error('Error loading stickers and keychains:', error);
      }
    };

    loadStickersAndKeychains();
  }, []);

  // Load existing customization settings
  useEffect(() => {
    const loadExistingCustomization = async () => {
      if (!skin && !agent) return;

      // For gloves, we don't need stickers and keychains data
      const needsStickersAndKeychains = skin && !(
        (typeof skin.weapon_defindex === 'string' && skin.weapon_defindex === 'gloves_default') ||
        (typeof skin.weapon_defindex === 'number' && skin.weapon_defindex >= 5027 && skin.weapon_defindex <= 5035) ||
        skin.paint_name.toLowerCase().includes('gloves')
      );

      if (needsStickersAndKeychains && (stickersData.length === 0 || keychainsData.length === 0)) return;

      setIsLoadingExisting(true);
      try {
        const response = await fetch('/api/user-skins');
        if (response.ok) {
          const data = await response.json();
          const userSkins = data.skins || [];

          // Find existing customization for this weapon/agent
          const existingCustomization = userSkins.find((userSkin: any) => {
            if (skin) {
              return userSkin.weapon_defindex === skin.weapon_defindex &&
                     userSkin.weapon_team === selectedTeam &&
                     userSkin.weapon_paint_id == skin.paint;
            } else if (agent) {
              return userSkin.weapon_defindex === parseInt(agent.model) &&
                     userSkin.weapon_team === selectedTeam;
            }
            return false;
          });

          if (existingCustomization) {
            // Parse stickers with actual data
            const parseSticker = (stickerStr: string) => {
              if (!stickerStr || stickerStr === '0;0;0;0;0;0;0') return null;
              const parts = stickerStr.split(';');
              if (parts[0] === '0') return null;
              return stickersData.find(s => s.id === parts[0]) || null;
            };

            // Parse keychain with actual data
            const parseKeychain = (keychainStr: string) => {
              if (!keychainStr || keychainStr === '0;0;0;0;0') return null;
              const parts = keychainStr.split(';');
              if (parts[0] === '0') return null;
              return keychainsData.find(k => k.id === parts[0]) || null;
            };

            setSettings({
              wear: existingCustomization.weapon_wear || 0.1,
              seed: existingCustomization.weapon_seed || 1,
              nameTag: existingCustomization.weapon_nametag || '',
              statTrak: existingCustomization.weapon_stattrak === 1,
              stickers: [
                parseSticker(existingCustomization.weapon_sticker_0 || ''),
                parseSticker(existingCustomization.weapon_sticker_1 || ''),
                parseSticker(existingCustomization.weapon_sticker_2 || ''),
                parseSticker(existingCustomization.weapon_sticker_3 || ''),
                parseSticker(existingCustomization.weapon_sticker_4 || ''),
              ],
              keychain: parseKeychain(existingCustomization.weapon_keychain || ''),
            });
          }
        }
      } catch (error) {
        console.error('Error loading existing customization:', error);
      } finally {
        setIsLoadingExisting(false);
      }
    };

    loadExistingCustomization();
  }, [skin, agent, selectedTeam, stickersData, keychainsData]);

  const getWearCondition = (wear: number) => {
    return wearConditions.find(condition => wear >= condition.min && wear < condition.max) || wearConditions[0];
  };

  const currentCondition = getWearCondition(settings.wear);

  const handleWearChange = (value: number[]) => {
    setSettings(prev => ({ ...prev, wear: value[0] }));
  };

  const handleSeedChange = (value: number[]) => {
    setSettings(prev => ({ ...prev, seed: value[0] }));
  };

  const handleStickerSelect = (index: number, sticker: CS2Sticker | null) => {
    setSettings(prev => {
      const newStickers = [...prev.stickers];
      newStickers[index] = sticker;
      return { ...prev, stickers: newStickers };
    });
  };

  const handleKeychainSelect = (keychain: CS2Keychain | null) => {
    setSettings(prev => ({ ...prev, keychain }));
  };

  const handleApply = async () => {
    if (!skin && !agent) return;

    setIsApplying(true);
    try {
      // Format stickers as "id;0;0;0;0;0;0" for each sticker slot
      const formatSticker = (sticker: CS2Sticker | null) => {
        return sticker ? `${sticker.id};0;0;0;0;0;0` : '0;0;0;0;0;0;0';
      };

      // Format keychain as "id;0;0;0;0"
      const formatKeychain = (keychain: CS2Keychain | null) => {
        return keychain ? `${keychain.id};0;0;0;0` : '0;0;0;0;0';
      };

      // Determine the type of item
      let itemType = 'weapons';
      if (skin) {
        // Check if it's a glove by weapon_defindex or paint_name
        const isGlove = (typeof skin.weapon_defindex === 'string' && skin.weapon_defindex === 'gloves_default') ||
                       (typeof skin.weapon_defindex === 'number' && skin.weapon_defindex >= 5027 && skin.weapon_defindex <= 5035) ||
                       skin.paint_name.toLowerCase().includes('gloves');

        if (isGlove) {
          itemType = 'gloves';
        } else if (skin.weapon_name && skin.weapon_name.includes('knife')) {
          itemType = 'knifes';
        } else {
          itemType = 'weapons';
        }
      } else if (agent) {
        itemType = 'agents';
      }

      const payload = {
        type: itemType,
        weapon_team: selectedTeam,
        weapon_defindex: skin ? skin.weapon_defindex : agent?.model,
        weapon_paint_id: skin ? skin.paint : agent?.model,
        weapon_wear: settings.wear,
        weapon_seed: settings.seed,
        weapon_nametag: settings.nameTag,
        weapon_stattrak: settings.statTrak ? 1 : 0,
        // Only include stickers and keychains for non-glove items
        ...(itemType !== 'gloves' && {
          weapon_sticker_0: formatSticker(settings.stickers[0]),
          weapon_sticker_1: formatSticker(settings.stickers[1]),
          weapon_sticker_2: formatSticker(settings.stickers[2]),
          weapon_sticker_3: formatSticker(settings.stickers[3]),
          weapon_sticker_4: formatSticker(settings.stickers[4]),
          weapon_keychain: formatKeychain(settings.keychain),
        })
      };

      const response = await fetch('/api/apply-skin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Skin applied successfully:', result);
        router.push('/skin-changer');
      } else {
        const error = await response.json();
        console.error('Failed to apply skin:', error);
        alert('Failed to apply skin configuration. Please try again.');
      }
    } catch (error) {
      console.error('Error applying skin:', error);
      alert('An error occurred while applying the skin configuration.');
    } finally {
      setIsApplying(false);
    }
  };

  const resetSettings = () => {
    setSettings({
      wear: 0.1,
      seed: 1,
      nameTag: '',
      statTrak: false,
      stickers: [null, null, null, null, null],
      keychain: null,
    });
  };

  if (!skin && !agent) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex items-center justify-center">
          <div className="text-white text-center">
            <h1 className="text-2xl font-bold mb-4">Loading...</h1>
            <p>Please wait while we load your weapon data.</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Check if we need to wait for stickers and keychains data
  const needsStickersAndKeychains = skin && !(
    (typeof skin.weapon_defindex === 'string' && skin.weapon_defindex === 'gloves_default') ||
    (typeof skin.weapon_defindex === 'number' && skin.weapon_defindex >= 5027 && skin.weapon_defindex <= 5035) ||
    skin.paint_name.toLowerCase().includes('gloves')
  );

  if (isLoadingExisting || (needsStickersAndKeychains && (stickersData.length === 0 || keychainsData.length === 0))) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex items-center justify-center">
          <div className="text-white text-center">
            <h1 className="text-2xl font-bold mb-4">Loading Customization...</h1>
            <p>Please wait while we load your existing settings.</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const item = skin || agent;
  const itemName = skin ? skin.paint_name : agent?.agent_name || '';
  const itemImage = skin ? skin.image : agent?.image || '';

  // Check if current item is a glove
  const isGlove = skin && (
    (typeof skin.weapon_defindex === 'string' && skin.weapon_defindex === 'gloves_default') ||
    (typeof skin.weapon_defindex === 'number' && skin.weapon_defindex >= 5027 && skin.weapon_defindex <= 5035) ||
    skin.paint_name.toLowerCase().includes('gloves')
  );

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 text-white">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              onClick={() => router.push('/skin-changer')}
              variant="ghost"
              size="sm"
              className="text-neutral-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Skin Changer
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Preview and Basic Settings */}
            <div className="space-y-6">
              {/* Weapon Preview */}
              <WeaponPreview
                item={item!}
                settings={settings}
                itemName={itemName}
                itemImage={itemImage}
              />

              {/* Basic Customization */}
              {skin && (
                <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Basic Customization</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Wear Float */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-neutral-300">Wear Float</Label>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${currentCondition.color}`} />
                          <span className="text-sm text-neutral-300">{currentCondition.name}</span>
                          <span className="text-sm text-neutral-400">({settings.wear.toFixed(3)})</span>
                        </div>
                      </div>
                      <Slider
                        value={[settings.wear]}
                        onValueChange={handleWearChange}
                        min={0}
                        max={0.99}
                        step={0.001}
                        className="w-full"
                      />
                    </div>

                    {/* Seed */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-neutral-300">Pattern Seed</Label>
                        <span className="text-sm text-neutral-400">{settings.seed}</span>
                      </div>
                      <Slider
                        value={[settings.seed]}
                        onValueChange={handleSeedChange}
                        min={1}
                        max={1000}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    {/* Name Tag */}
                    <div className="space-y-2">
                      <Label className="text-neutral-300">Name Tag</Label>
                      <Input
                        value={settings.nameTag}
                        onChange={(e) => setSettings(prev => ({ ...prev, nameTag: e.target.value }))}
                        placeholder="Enter custom name..."
                        className="bg-white/5 border-white/10 text-white placeholder:text-neutral-400"
                        maxLength={20}
                      />
                    </div>

                    {/* StatTrak */}
                    <div className="flex items-center justify-between">
                      <Label className="text-neutral-300">StatTrak™</Label>
                      <Switch
                        checked={settings.statTrak}
                        onCheckedChange={(checked) => setSettings(prev => ({ ...prev, statTrak: checked }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Stickers and Keychains */}
            <div className="space-y-6">
              {/* Sticker Selection - Only for non-glove items */}
              {skin && !isGlove && (
                <StickerSelector
                  selectedStickers={settings.stickers}
                  onStickerSelect={handleStickerSelect}
                />
              )}

              {/* Keychain Selection - Only for non-glove items */}
              {skin && !isGlove && (
                <KeychainSelector
                  selectedKeychain={settings.keychain}
                  onKeychainSelect={handleKeychainSelect}
                />
              )}

              {/* Info message for gloves */}
              {isGlove && (
                <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                  <CardContent className="p-6 text-center">
                    <p className="text-neutral-400">
                      Gloves don't support stickers or keychains.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4">
                <Button
                  onClick={resetSettings}
                  variant="outline"
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  Reset
                </Button>
                <Button
                  onClick={handleApply}
                  disabled={isApplying}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isApplying ? 'Applying...' : 'Apply Configuration'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function WeaponCustomizePage() {
  return (
    <Suspense fallback={
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex items-center justify-center">
          <div className="text-white text-center">
            <h1 className="text-2xl font-bold mb-4">Loading...</h1>
            <p>Please wait while we load your weapon data.</p>
          </div>
        </div>
      </ProtectedRoute>
    }>
      <WeaponCustomizeContent />
    </Suspense>
  );
}
