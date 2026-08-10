"use client"

import { useState } from 'react';
import { Conversation, Message } from '@/types/messages';

export const useMessaging = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: '1',
      name: 'Sarah Johnson',
      lastMessage: 'Thank you for the quick response! The maintenance issue has been resolved.',
      timestamp: '2 min ago',
      unread: 0,
      avatar: 'SJ',
      type: 'tenant',
      status: 'online',
    },
    {
      id: '2',
      name: 'Property Manager',
      lastMessage: 'Monthly report for January is now available in your dashboard.',
      timestamp: '1 hour ago',
      unread: 2,
      avatar: 'PM',
      type: 'system',
      status: 'away',
    },
    {
      id: '3',
      name: 'Michael Chen',
      lastMessage: 'Could you please send me the lease renewal documents?',
      timestamp: '3 hours ago',
      unread: 1,
      avatar: 'MC',
      type: 'tenant',
      status: 'offline',
    },
    {
      id: '4',
      name: 'Robert Thompson',
      lastMessage: 'I would like to discuss the property valuation for Downtown Apartment 4A.',
      timestamp: 'Yesterday',
      unread: 0,
      avatar: 'RT',
      type: 'homeowner',
      status: 'online',
    },
  ]);

  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);

  const getMessagesForConversation = (conversationId: string): Message[] => {
    const messageMap: Record<string, Message[]> = {
      '1': [
        {
          id: '1',
          senderId: '1',
          senderName: 'Sarah Johnson',
          content: 'Hi, I noticed that the kitchen faucet in my apartment is leaking. Could someone take a look at it?',
          timestamp: '10:30 AM',
          isOwn: false,
        },
        {
          id: '2',
          senderId: 'me',
          senderName: 'You',
          content: 'Hi Sarah! Thank you for reporting this. I\'ll schedule a maintenance visit for tomorrow morning. Is 9 AM convenient for you?',
          timestamp: '10:45 AM',
          isOwn: true,
        },
        {
          id: '3',
          senderId: '1',
          senderName: 'Sarah Johnson',
          content: 'Perfect! 9 AM works great for me. Should I be present during the repair?',
          timestamp: '10:47 AM',
          isOwn: false,
        },
        {
          id: '4',
          senderId: 'me',
          senderName: 'You',
          content: 'Yes, please be available as the technician might need access to the water shut-off valve under the sink. The repair should take about 30 minutes.',
          timestamp: '11:00 AM',
          isOwn: true,
        },
        {
          id: '5',
          senderId: '1',
          senderName: 'Sarah Johnson',
          content: 'Thank you for the quick response! The maintenance issue has been resolved.',
          timestamp: '2 min ago',
          isOwn: false,
        },
      ],
      '2': [
        {
          id: '1',
          senderId: '2',
          senderName: 'Property Manager',
          content: 'Monthly report for January is now available in your dashboard.',
          timestamp: '1 hour ago',
          isOwn: false,
        },
      ],
      '3': [
        {
          id: '1',
          senderId: '3',
          senderName: 'Michael Chen',
          content: 'Could you please send me the lease renewal documents?',
          timestamp: '3 hours ago',
          isOwn: false,
        },
      ],
      '4': [
        {
          id: '1',
          senderId: '4',
          senderName: 'Robert Thompson',
          content: 'I would like to discuss the property valuation for Downtown Apartment 4A.',
          timestamp: 'Yesterday',
          isOwn: false,
        },
      ],
    };
    
    return messageMap[conversationId] || [];
  };

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversation(conversationId);
    setIsMobileMenuOpen(false);
  };

  const handleSendMessage = (message: string) => {
    console.log('Sending message:', message);
    // In a real app, this would send to an API and update the messages
  };

  const handleAddConversation = (data: any) => {
    console.log('Adding new conversation:', data);
    // Generate a simple avatar from the name
    const avatar = data.name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
    
    const newConversation: Conversation = {
      id: Date.now().toString(), // Simple ID generation for demo
      name: data.name,
      lastMessage: 'No messages yet',
      timestamp: 'Just now',
      unread: 0,
      avatar,
      type: data.type,
      status: 'offline',
    };

    setConversations(prev => [newConversation, ...prev]);
    
    // In a real app, you would:
    // - Send the data to your API
    // - Handle validation and error states
    // - Update the conversation list from the server response
  };

  /**
   * FIX: Move to archive ONLY if it is not already archived
   * and remove from conversations completely.
   * Set selectedConversation to null if currently selected.
   */
  const handleArchiveConversation = (conversationId: string) => {
    setConversations(prev => {
      const conversationToArchive = prev.find(c => c.id === conversationId);
      if (!conversationToArchive) return prev;
      setArchivedConversations((archivedPrev) => {
        // Prevent duplicate in archive
        if (archivedPrev.find(ac => ac.id === conversationId)) return archivedPrev;
        return [conversationToArchive, ...archivedPrev];
      });
      // Deselect if archived
      if (selectedConversation === conversationId) setSelectedConversation(null);
      // Remove from main list
      return prev.filter(c => c.id !== conversationId);
    });
  };

  /**
   * FIX: Move to main if it is inside archive,
   * and remove from archive completely.
   */
  const handleUnarchiveConversation = (conversationId: string) => {
    setArchivedConversations(prev => {
      const conversationToUnarchive = prev.find(c => c.id === conversationId);
      if (!conversationToUnarchive) return prev;
      setConversations((mainPrev) => {
        // Prevent duplicate in main
        if (mainPrev.find(mc => mc.id === conversationId)) return mainPrev;
        return [conversationToUnarchive, ...mainPrev];
      });
      // Remove from archive list
      return prev.filter(c => c.id !== conversationId);
    });
  };

  const handleBackToList = () => {
    setIsMobileMenuOpen(true);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return {
    conversations,
    archivedConversations,
    selectedConversation,
    isMobileMenuOpen,
    getMessagesForConversation,
    handleConversationSelect,
    handleSendMessage,
    handleAddConversation,
    handleArchiveConversation,
    handleUnarchiveConversation,
    handleBackToList,
    toggleMobileMenu,
  };
};